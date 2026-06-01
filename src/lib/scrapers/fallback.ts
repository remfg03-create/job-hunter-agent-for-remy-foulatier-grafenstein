/**
 * Sample-data fallback.
 *
 * Live scraping of job boards is brittle: sites rate-limit, change HTML, and
 * forbid bots in their ToS. To guarantee a working demo + cron run, every
 * scraper falls back to these bundled sample postings when a live fetch fails
 * or returns nothing. Each sample is tagged `isSample: true` and filtered to
 * the requested source.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RawJob } from "./types";

let cache: RawJob[] | null = null;

async function loadAll(): Promise<RawJob[]> {
  if (cache) return cache;
  // Try the filesystem (works in dev, CLI, and serverless where data/ is bundled).
  try {
    const raw = await readFile(join(process.cwd(), "data", "sample-jobs.json"), "utf-8");
    cache = (JSON.parse(raw) as RawJob[]).map((j) => ({ ...j, isSample: true }));
  } catch {
    cache = [];
  }
  return cache;
}

/** Return the sample jobs for a single source. */
export async function sampleJobsFor(source: string): Promise<RawJob[]> {
  const all = await loadAll();
  return all.filter((j) => j.source === source);
}
