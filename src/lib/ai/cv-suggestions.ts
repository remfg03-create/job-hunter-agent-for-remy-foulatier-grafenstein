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

export async function generateCVSuggestions(cv: string, job: ScoredJob): Promise<CVSuggestion[]> {
  const client = getAnthropic();
  if (!client) {
    throw new Error("ANTHROPIC_API_KEY is not set — add it to generate CV suggestions.");
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
