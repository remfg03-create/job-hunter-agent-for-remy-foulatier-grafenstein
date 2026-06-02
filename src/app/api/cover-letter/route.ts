import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import type { ScoredJob } from "@/lib/scrapers/types";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function cvText(provided?: string): Promise<string> {
  if (provided && provided.trim()) return provided;
  const saved = await store.getCV();
  if (saved?.text) return saved.text;
  return readFile(join(process.cwd(), "data", "cv.example.txt"), "utf-8");
}

/**
 * POST /api/cover-letter { job, cv? } — generate a tailored cover letter.
 * The full job is sent by the client (serverless instances don't share the
 * in-memory store), with the CV text optional (falls back to the active CV).
 */
export async function POST(req: NextRequest) {
  try {
    const { job, cv } = (await req.json()) as { job: ScoredJob; cv?: string };
    if (!job?.title) return NextResponse.json({ ok: false, error: "Missing job data." }, { status: 400 });

    const letter = await generateCoverLetter(await cvText(cv), job);
    return NextResponse.json({ ok: true, letter });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
