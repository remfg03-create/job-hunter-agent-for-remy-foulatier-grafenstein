/**
 * Shared scraper utilities: defensive fetching, query building, and a
 * keyword/location filter applied to live results so each source returns only
 * jobs that broadly fit the criteria before the AI scores them.
 */

import type { SearchCriteria } from "@/lib/config";
import type { RawJob } from "./types";

/** Browser-like headers reduce trivial bot blocks (best-effort, not evasion). */
export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "en,fr;q=0.9,de;q=0.8",
};

/** fetch with an AbortController timeout so a hung site never stalls a scan. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** Build a compact "role keywords" query string from the criteria. */
export function buildQuery(criteria: SearchCriteria): string {
  return criteria.roles.slice(0, 4).join(" ");
}

/** Strip HTML tags + collapse whitespace from a scraped description snippet. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lightweight relevance filter for live results — keeps a job if its title or
 * description touches any target role/keyword AND it is in a target location
 * (location check is lenient: empty/unknown locations pass through).
 */
export function matchesCriteria(job: RawJob, criteria: SearchCriteria): boolean {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const terms = [...criteria.roles, ...criteria.keywords].map((t) => t.toLowerCase());
  const roleHit = terms.some((t) => haystack.includes(t.split(" ")[0]));

  const loc = job.location.toLowerCase();
  const locHit =
    !loc || criteria.locations.some((l) => loc.includes(l.toLowerCase())) ||
    loc.includes("remote") || loc.includes("télétravail");

  return roleHit && locHit;
}

/** Run a scraper, swallow any error, and return [] so one bad source never
 *  breaks the whole scan. The caller layers in the sample fallback. */
export async function safely(fn: () => Promise<RawJob[]>, label: string): Promise<RawJob[]> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[scraper:${label}] live fetch failed, using fallback — ${(err as Error).message}`);
    return [];
  }
}
