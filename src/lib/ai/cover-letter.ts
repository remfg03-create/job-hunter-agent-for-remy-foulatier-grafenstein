/**
 * Cover-letter generator — writes a tailored letter for a specific job using
 * the candidate's CV and the AI's match analysis.
 */

import { APP_NAME, MODELS } from "@/lib/config";
import type { ScoredJob } from "@/lib/scrapers/types";
import { getAnthropic } from "./client";

const SYSTEM = `You write concise, sincere, well-structured cover letters for a real candidate.
Rules:
- 250–320 words, 3–4 short paragraphs, ready to send.
- Match the language of the job posting (French job -> French letter; English -> English; German -> German).
- Open with genuine, specific interest in THIS company/role (no generic filler).
- Use concrete evidence from the CV that maps to the job's needs.
- Warm, confident, professional tone. No clichés ("I am writing to apply"), no emojis, no markdown.
- End with a courteous call to action and the candidate's name.
- Never invent experience that is not in the CV.`;

export async function generateCoverLetter(cv: string, job: ScoredJob): Promise<string> {
  const client = getAnthropic();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY is not set — add it to generate cover letters.");
  }

  const msg = await client.messages.create({
    model: MODELS.writing,
    max_tokens: 900,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Candidate name: ${APP_NAME}

CANDIDATE CV:
${cv}

----

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description:
${job.description}

Match analysis — strengths to emphasise: ${job.matchingSkills.join(", ") || "n/a"}.
Gaps to address gracefully (don't dwell): ${job.missingSkills.join(", ") || "none"}.

Write the cover letter now. Output ONLY the letter text.`,
      },
    ],
  });

  return msg.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("\n")
    .trim();
}
