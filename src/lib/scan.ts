/**
 * Full scan pipeline: scrape 5 sites → score every job against the CV → persist.
 * Called by the dashboard "Run scan" button, the cron route, and the CLI.
 */

import { scrapeAll } from "@/lib/scrapers";
import { scoreJobs } from "@/lib/ai/score";
import { store } from "@/lib/store";
import { DEFAULT_CRITERIA } from "@/lib/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ScoredJob } from "@/lib/scrapers/types";

export interface ScanResult {
  jobs: ScoredJob[];
  perSource: { source: string; name: string; live: number; sample: number }[];
  cvFilename: string;
  usedSampleCV: boolean;
  scannedAt: string;
}

/** Load the active CV text — uploaded CV from the store, else the bundled sample. */
async function loadCV(): Promise<{ text: string; filename: string; isSample: boolean }> {
  const saved = await store.getCV();
  if (saved?.text) return { text: saved.text, filename: saved.filename, isSample: false };
  const text = await readFile(join(process.cwd(), "data", "cv.example.txt"), "utf-8");
  return { text, filename: "cv.example.txt", isSample: true };
}

export async function runScan(): Promise<ScanResult> {
  const criteria = (await store.getCriteria()) || DEFAULT_CRITERIA;
  const cv = await loadCV();

  const { jobs: rawJobs, perSource } = await scrapeAll(criteria);
  const scored = await scoreJobs(cv.text, rawJobs);

  await store.saveJobs(scored);

  return {
    jobs: scored,
    perSource,
    cvFilename: cv.filename,
    usedSampleCV: cv.isSample,
    scannedAt: new Date().toISOString(),
  };
}
