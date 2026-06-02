import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createDraft, gmailConfig } from "@/lib/gmail";
import { APP_NAME } from "@/lib/config";
import type { ScoredJob } from "@/lib/scrapers/types";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function cvText(provided?: string): Promise<string> {
  if (provided && provided.trim()) return provided;
  const saved = await store.getCV();
  if (saved?.text) return saved.text;
  return readFile(join(process.cwd(), "data", "cv.example.txt"), "utf-8");
}

/**
 * POST /api/apply { job, coverLetter, to?, cv? }
 * If Gmail is configured, creates a reviewable Gmail DRAFT (never sends) with
 * the cover letter as the body and the cover letter + CV attached.
 * If Gmail is NOT configured, returns a `mailto:` link the browser can open so
 * the application still works out of the box (opens a prefilled email draft).
 */
export async function POST(req: NextRequest) {
  try {
    const { job, coverLetter, to, cv } = (await req.json()) as {
      job: ScoredJob;
      coverLetter: string;
      to?: string;
      cv?: string;
    };

    if (!job?.title) return NextResponse.json({ ok: false, error: "Missing job data." }, { status: 400 });
    if (!coverLetter?.trim()) {
      return NextResponse.json({ ok: false, error: "Generate a cover letter first." }, { status: 400 });
    }

    const subject = `Application — ${job.title} at ${job.company}`;
    const body = `${coverLetter}\n\n—\n${APP_NAME}\n\nRole: ${job.title} @ ${job.company} (${job.location})\nPosting: ${job.url}`;

    const cfg = gmailConfig();
    const gmailReady = Boolean(cfg?.refreshToken);

    if (!gmailReady) {
      // Graceful fallback: a mailto link (prefilled email draft in the user's mail app).
      const mailto = `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(body)}`;
      return NextResponse.json({
        ok: true,
        mode: "mailto",
        mailto,
        message:
          "Gmail isn't connected yet, so I opened a prefilled email draft instead. Connect Gmail (see README) to create drafts directly in your account.",
      });
    }

    const cvData = await cvText(cv);
    const result = await createDraft({
      to: to || "",
      subject,
      body,
      attachments: [
        { filename: `Cover Letter - ${APP_NAME}.txt`, content: coverLetter },
        { filename: `CV - ${APP_NAME}.txt`, content: cvData },
      ],
    });

    return NextResponse.json({ ok: true, mode: "gmail", ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
