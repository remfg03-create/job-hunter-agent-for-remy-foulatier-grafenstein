/**
 * CV suggestion generator — proposes targeted edits to better fit a specific
 * job. Returns a structured list the dashboard renders as accept/reject cards.
 */

import { MODELS } from "@/lib/config";
import type { ScoredJob } from "@/lib/scrapers/types";
import { getAnthropic } from "./client";

export interface CVSuggestion {
  /** Which part of the CV this targets (e.g. "Summary", "Experience: Intern"). */
  section: string;
  /** What to change and why, one or two sentences. */
  suggestion: string;
  /** A concrete rewritten bullet/line the candidate can paste in. */
  example: string;
  priority: "high" | "medium" | "low";
}

const TOOL = {
  name: "report_suggestions",
  description: "Return targeted CV improvements for this specific job.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            section: { type: "string" },
            suggestion: { type: "string" },
            example: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["section", "suggestion", "example", "priority"],
        },
      },
    },
    required: ["suggestions"],
  },
};

const SYSTEM = `You are a CV coach. Given a CV and one job posting, propose 3–6 specific,
honest edits that would make the CV land better for THIS job. Prioritise surfacing
existing-but-buried strengths and rephrasing to mirror the job's language. Never
fabricate experience. Each suggestion needs a concrete, paste-ready example line.`;

/** Template fallback when no API key is set — derives advice from the job's gaps. */
function templateSuggestions(job: ScoredJob): CVSuggestion[] {
  const out: CVSuggestion[] = [
    {
      section: "Professional summary",
      suggestion: `Open your CV with a 2-line summary tailored to "${job.title}" at ${job.company}, framing yourself as a motivated junior in hospitality/events/marketing.`,
      example: `Early-career sales & events professional (FR/EN) eager to grow in hospitality & lifestyle — internship experience in client outreach and event delivery.`,
      priority: "high",
    },
    {
      section: "Skills",
      suggestion: "Mirror the exact keywords from this posting in your skills section so it passes screening.",
      example: `Skills: ${[...job.matchingSkills, ...job.missingSkills].slice(0, 8).join(" · ") || "Sales · Events · Marketing · CRM · French · English"}`,
      priority: "high",
    },
    {
      section: "Experience bullets",
      suggestion: "Rewrite internship bullets to lead with action verbs and quantified outcomes, even small numbers count for a junior.",
      example: "Coordinated 8 brand events end-to-end (suppliers, budget, on-site), contributing to €120k of booked business.",
      priority: "medium",
    },
  ];
  for (const skill of job.missingSkills.slice(0, 2)) {
    out.push({
      section: "Address a gap",
      suggestion: `The role asks for "${skill}" which is light on your CV. Surface any coursework, project or transferable experience, or note you're actively learning it.`,
      example: `${skill}: gained through coursework and a student project; quick to apply in a professional setting.`,
      priority: "low",
    });
  }
  return out;
}

export async function generateCVSuggestions(cv: string, job: ScoredJob): Promise<CVSuggestion[]> {
  const client = getAnthropic();
  if (!client) {
    return templateSuggestions(job);
  }

  const msg = await client.messages.create({
    model: MODELS.writing,
    max_tokens: 1200,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "report_suggestions" },
    messages: [
      {
        role: "user",
        content: `CANDIDATE CV:\n${cv}\n\n----\n\nJOB:\nTitle: ${job.title}\nCompany: ${job.company}\nDescription:\n${job.description}\n\nMissing/weak skills flagged: ${job.missingSkills.join(", ") || "none"}.\n\nReturn tailored CV suggestions via report_suggestions.`,
      },
    ],
  });

  const tool = msg.content.find((c) => c.type === "tool_use");
  if (!tool || tool.type !== "tool_use") return [];
  return (tool.input as { suggestions: CVSuggestion[] }).suggestions ?? [];
}
