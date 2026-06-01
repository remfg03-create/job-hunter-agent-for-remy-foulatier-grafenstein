/**
 * CV parsing — extracts plain text from PDF and Word (.docx) CVs.
 *
 * - PDF  → `pdf-parse` (imported from its lib entry to avoid the package's
 *          debug-mode side effect that reads a test file on require).
 * - DOCX → `mammoth` (raw text extraction).
 * - TXT  → passed through as UTF-8.
 *
 * Used by both the upload API route and the `scripts/parse-cv.ts` CLI.
 */

import mammoth from "mammoth";

export interface ParsedCV {
  text: string;
  /** Rough word count, handy for the UI. */
  wordCount: number;
  format: "pdf" | "docx" | "txt";
}

function normalise(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function parsePdf(buffer: Buffer): Promise<string> {
  // Import the lib file directly — `require("pdf-parse")` runs test code when
  // there is no module parent, which throws in a bundled/serverless context.
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
    data: Buffer
  ) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return result.text;
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Parse a CV buffer into clean text. `filename` (or an explicit `format`) drives
 * the parser selection.
 */
export async function parseCV(
  buffer: Buffer,
  filename: string,
  format?: ParsedCV["format"]
): Promise<ParsedCV> {
  const ext = (format || filename.split(".").pop() || "").toLowerCase();

  let text: string;
  let resolved: ParsedCV["format"];

  if (ext === "pdf") {
    text = await parsePdf(buffer);
    resolved = "pdf";
  } else if (ext === "docx" || ext === "doc") {
    text = await parseDocx(buffer);
    resolved = "docx";
  } else if (ext === "txt") {
    text = buffer.toString("utf-8");
    resolved = "txt";
  } else {
    throw new Error(
      `Unsupported CV format: ".${ext}". Please upload a PDF, Word (.docx) or .txt file.`
    );
  }

  const clean = normalise(text);
  if (!clean) {
    throw new Error(
      "Could not extract any text from this CV. If it's a scanned PDF (image), please upload a text-based PDF or a .docx file."
    );
  }

  return {
    text: clean,
    wordCount: clean.split(/\s+/).filter(Boolean).length,
    format: resolved,
  };
}
