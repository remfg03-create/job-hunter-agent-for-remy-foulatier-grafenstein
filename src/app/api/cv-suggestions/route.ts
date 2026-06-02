import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { generateCVSuggestions } from "@/lib/ai/cv-suggestions";
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

/** POST /api/cv-suggestions { job, cv? } — tailored CV improvement suggestions. */
export async function POST(req: NextRequest) {
  try {
    const { job, cv } = (await req.json()) as { job: ScoredJob; cv?: string };
    if (!job?.title) return NextResponse.json({ ok: false, error: "Missing job data." }, { status: 400 });

    const suggestions = await generateCVSuggestions(await cvText(cv), job);
    return NextResponse.json({ ok: true, suggestions });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
