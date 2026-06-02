/**
 * AI Evaluator — grades each job 1–10 against the CV and lists matching /
 * missing skills with a short rationale.
 *
 * Uses a forced tool call so Claude must return well-formed structured data
 * (no brittle JSON-from-prose parsing). When no API key is present, falls back
 * to a transparent keyword heuristic so the dashboard still shows scores.
 */

import { MODELS } from "@/lib/config";
import type { RawJob, ScoredJob } from "@/lib/scrapers/types";
import { getAnthropic, hasAI, mapWithConcurrency } from "./client";

const SYSTEM = `You are a meticulous technical recruiter and career coach.
You evaluate how well a candidate's CV matches a specific job posting.
Be honest and calibrated — do NOT inflate scores. Use the full 1–10 range:
- 9–10: excellent fit, candidate clearly qualified, apply immediately.
- 7–8: strong fit, a few gaps but very much worth applying.
- 5–6: partial fit, transferable skills but notable missing requirements.
- 3–4: weak fit, major gaps.
- 1–2: not a fit.
Base the score ONLY on evidence in the CV versus the job's stated needs.
Skills lists must be concrete (e.g. "B2B sales", "event budgeting", "German"),
not vague. Keep reasoning to 2–3 sentences.`;

const TOOL = {
  name: "report_match",
  description: "Report the compatibility evaluation between the CV and the job.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: { type: "integer", minimum: 1, maximum: 10, description: "Compatibility 1–10." },
      matchingSkills: {
        type: "array",
        items: { type: "string" },
        description: "Concrete skills/experience from the CV that match this job.",
      },
      missingSkills: {
        type: "array",
        items: { type: "string" },
        description: "Concrete skills/requirements the job wants that the CV lacks or under-evidences.",
      },
      reasoning: { type: "string", description: "2–3 sentence rationale for the score." },
    },
    required: ["score", "matchingSkills", "missingSkills", "reasoning"],
  },
};

function jobBlock(job: RawJob): string {
  return [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}`,
    `Contract: ${job.contractType || "n/a"}`,
    `Description:\n${job.description}`,
  ].join("\n");
}

async function scoreOne(cv: string, job: RawJob): Promise<ScoredJob> {
  const client = getAnthropic();
  if (!client) return heuristicScore(cv, job);

  try {
    const msg = await client.messages.create({
      model: MODELS.scoring,
      max_tokens: 600,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "report_match" },
      messages: [
        {
          role: "user",
          content: `CANDIDATE CV:\n${cv}\n\n----\n\nJOB POSTING:\n${jobBlock(job)}\n\nNote: the candidate is EARLY-CAREER / JUNIOR. Judge fit for THIS role's actual seniority — a senior/managerial posting should score lower for a junior, while junior/assistant/coordinator roles that match the skills should score higher. Evaluate and call report_match.`,
        },
      ],
    });

    const tool = msg.content.find((c) => c.type === "tool_use");
    if (!tool || tool.type !== "tool_use") return heuristicScore(cv, job);
    const out = tool.input as {
      score: number;
      matchingSkills: string[];
      missingSkills: string[];
      reasoning: string;
    };

    return {
      ...job,
      score: Math.min(10, Math.max(1, Math.round(out.score))),
      matchingSkills: out.matchingSkills ?? [],
      missingSkills: out.missingSkills ?? [],
      reasoning: out.reasoning ?? "",
      scoredAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[score] AI failed for ${job.id}, using heuristic — ${(err as Error).message}`);
    return heuristicScore(cv, job);
  }
}

/**
 * Transparent keyword-overlap fallback used when the API is unavailable.
 * Calibrated for an EARLY-CAREER / JUNIOR candidate: senior-titled roles are
 * penalised and junior-friendly roles rewarded, producing a realistic spread
 * (not everything at 10/10).
 */
function heuristicScore(cv: string, job: RawJob): ScoredJob {
  const cvLower = cv.toLowerCase();
  const terms = [
    "sales", "business development", "event", "marketing", "partnership", "hospitality",
    "crm", "budget", "client", "negotiation", "french", "english", "german", "social media",
    "luxury", "lifestyle", "food", "beverage", "brand",
  ];
  const text = `${job.title} ${job.description}`.toLowerCase();
  const title = job.title.toLowerCase();
  const matching = terms.filter((t) => text.includes(t) && cvLower.includes(t));
  const missing = terms.filter((t) => text.includes(t) && !cvLower.includes(t));

  const senior = /(senior|lead|head|director|principal|expérimenté|10\+|7\+|5\+ years|manager)/.test(title);
  const junior = /(junior|assistant|coordinat|chargé|stage|intern|alternance|graduate|entry|trainee|werkstudent)/.test(title);

  let score = 5 + Math.min(3, matching.length * 0.6);
  if (junior) score += 1.5;
  if (senior) score -= 2.5;
  score = Math.max(2, Math.min(10, Math.round(score)));

  const note = senior
    ? "Likely a stretch for a junior profile (senior-level title), but transferable skills overlap."
    : junior
    ? "Well-suited to an early-career candidate — strong skill overlap and a junior-friendly level."
    : "Solid overlap between the CV and the posting for an early-career candidate.";

  return {
    ...job,
    score,
    matchingSkills: matching,
    missingSkills: missing,
    reasoning: `${note} (Heuristic score — set ANTHROPIC_API_KEY for a full AI evaluation.)`,
    scoredAt: new Date().toISOString(),
  };
}

/** Score a batch of jobs against the CV, highest score first. */
export async function scoreJobs(cv: string, jobs: RawJob[]): Promise<ScoredJob[]> {
  const concurrency = hasAI() ? 5 : jobs.length;
  const scored = await mapWithConcurrency(jobs, concurrency, (job) => scoreOne(cv, job));
  return scored.sort((a, b) => b.score - a.score);
}
