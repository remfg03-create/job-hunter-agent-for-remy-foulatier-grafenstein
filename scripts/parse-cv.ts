#!/usr/bin/env tsx
/**
 * CV Parser CLI
 * -------------
 * Extracts plain text from a PDF or Word (.docx) CV and prints it.
 *
 * Usage:
 *   npm run parse-cv -- path/to/cv.pdf
 *   npx tsx scripts/parse-cv.ts path/to/cv.docx --json
 *
 * Flags:
 *   --json   Print a JSON object { text, wordCount, format } instead of raw text.
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parseCV } from "../src/lib/cv/parse";

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error("Usage: npm run parse-cv -- <path-to-cv.(pdf|docx|txt)> [--json]");
    process.exit(1);
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    console.error(`✖ Could not read file: ${filePath}`);
    process.exit(1);
  }

  try {
    const parsed = await parseCV(buffer, basename(filePath));
    if (json) {
      console.log(JSON.stringify(parsed, null, 2));
    } else {
      console.log(`\n──────── Extracted from ${basename(filePath)} `);
      console.log(`format: ${parsed.format} · words: ${parsed.wordCount}\n`);
      console.log(parsed.text);
    }
  } catch (err) {
    console.error(`✖ ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
