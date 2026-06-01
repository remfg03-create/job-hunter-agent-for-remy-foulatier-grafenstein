import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron — token-secured scan trigger for the scheduler (GitHub Actions
 * every 6h = 4×/day, or Vercel Cron). Protected by CRON_SECRET passed either as
 * `?secret=` or an `Authorization: Bearer` header (Vercel Cron sends the latter).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const fromQuery = req.nextUrl.searchParams.get("secret");
    const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (fromQuery !== secret && fromHeader !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runScan();
    return NextResponse.json({
      ok: true,
      scannedAt: result.scannedAt,
      jobCount: result.jobs.length,
      topScore: result.jobs[0]?.score ?? null,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
