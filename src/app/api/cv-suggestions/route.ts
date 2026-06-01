import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { generateCVSuggestions } from "@/lib/ai/cv-suggestions";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function cvText(): Promise<string> {
  const saved = await store.getCV();
  if (saved?.text) return saved.text;
  return readFile(join(process.cwd(), "data", "cv.example.txt"), "utf-8");
}

/** POST /api/cv-suggestions { jobId } — tailored CV improvement suggestions. */
export async function POST(req: NextRequest) {
  try {
    const { jobId } = (await req.json()) as { jobId: string };
    const jobs = await store.getJobs();
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return NextResponse.json({ ok: false, error: "Job not found. Run a scan first." }, { status: 404 });

    const suggestions = await generateCVSuggestions(await cvText(), job);
    return NextResponse.json({ ok: true, suggestions });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
