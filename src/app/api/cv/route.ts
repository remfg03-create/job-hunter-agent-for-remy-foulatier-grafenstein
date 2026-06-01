import { NextRequest, NextResponse } from "next/server";
import { parseCV } from "@/lib/cv/parse";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET /api/cv — current CV metadata. */
export async function GET() {
  const cv = await store.getCV();
  return NextResponse.json(
    cv ? { filename: cv.filename, updatedAt: cv.updatedAt, wordCount: cv.text.split(/\s+/).length, preview: cv.text.slice(0, 600) } : null
  );
}

/** POST /api/cv — upload a PDF/Word/txt CV (multipart), parse + store its text. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ ok: false, error: "No file uploaded." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseCV(buffer, file.name);
    await store.saveCV(parsed.text, file.name);

    return NextResponse.json({
      ok: true,
      filename: file.name,
      format: parsed.format,
      wordCount: parsed.wordCount,
      preview: parsed.text.slice(0, 600),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
