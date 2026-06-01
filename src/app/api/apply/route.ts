import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createDraft } from "@/lib/gmail";
import { APP_NAME } from "@/lib/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function cvText(): Promise<{ text: string; filename: string }> {
  const saved = await store.getCV();
  if (saved?.text) return { text: saved.text, filename: saved.filename };
  const text = await readFile(join(process.cwd(), "data", "cv.example.txt"), "utf-8");
  return { text, filename: "cv.txt" };
}

/**
 * POST /api/apply { jobId, coverLetter, to? }
 * Creates a reviewable Gmail DRAFT (never sends) with the cover letter as the
 * body and the cover letter + CV attached. Returns a link to the Drafts folder.
 */
export async function POST(req: NextRequest) {
  try {
    const { jobId, coverLetter, to } = (await req.json()) as {
      jobId: string;
      coverLetter: string;
      to?: string;
    };

    const jobs = await store.getJobs();
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
    if (!coverLetter?.trim()) {
      return NextResponse.json({ ok: false, error: "Generate a cover letter first." }, { status: 400 });
    }

    const cv = await cvText();
    const subject = `Application — ${job.title} at ${job.company}`;
    const body = `${coverLetter}\n\n—\n${APP_NAME}\n\nRole: ${job.title} @ ${job.company} (${job.location})\nPosting: ${job.url}`;

    const result = await createDraft({
      to: to || "",
      subject,
      body,
      attachments: [
        { filename: `Cover Letter - ${APP_NAME}.txt`, content: coverLetter },
        { filename: `CV - ${APP_NAME}.txt`, content: cv.text },
      ],
    });

    await store.markApplied(jobId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
