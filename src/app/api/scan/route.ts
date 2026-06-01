import { NextResponse } from "next/server";
import { runScan } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/scan — run a full scrape + score pass and persist the results. */
export async function POST() {
  try {
    const result = await runScan();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[/api/scan]", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
