import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { SearchCriteria } from "@/lib/config";

export const dynamic = "force-dynamic";

/** GET /api/criteria — current search criteria. */
export async function GET() {
  return NextResponse.json(await store.getCriteria());
}

/** POST /api/criteria — update the search criteria from the Settings panel. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SearchCriteria>;
    const current = await store.getCriteria();
    const merged: SearchCriteria = {
      roles: body.roles ?? current.roles,
      locations: body.locations ?? current.locations,
      contractTypes: body.contractTypes ?? current.contractTypes,
      keywords: body.keywords ?? current.keywords,
      languages: body.languages ?? current.languages,
    };
    await store.saveCriteria(merged);
    return NextResponse.json({ ok: true, criteria: merged });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
