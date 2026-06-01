import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { hasAI } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

/** GET /api/jobs — current scored jobs + dashboard metadata. */
export async function GET() {
  const [jobs, applied, lastScan, cv] = await Promise.all([
    store.getJobs(),
    store.getApplied(),
    store.getLastScan(),
    store.getCV(),
  ]);

  return NextResponse.json({
    jobs,
    applied,
    lastScan,
    cv: cv ? { filename: cv.filename, updatedAt: cv.updatedAt, wordCount: cv.text.split(/\s+/).length } : null,
    aiEnabled: hasAI(),
    storeBackend: store.backend,
  });
}
