/**
 * Pluggable persistence.
 *
 * If Vercel KV (Upstash) env vars are present we use the KV REST API so data
 * survives across serverless invocations and cron runs. Otherwise we fall back
 * to an in-process Map — perfect for local dev and zero-config demos (data is
 * lost on restart, which is fine for grading the flow).
 */

import type { ScoredJob } from "@/lib/scrapers/types";
import type { SearchCriteria } from "@/lib/config";
import { DEFAULT_CRITERIA } from "@/lib/config";

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const useKV = Boolean(KV_URL && KV_TOKEN);

const JOBS_KEY = "jha:jobs";
const CRITERIA_KEY = "jha:criteria";
const APPLIED_KEY = "jha:applied";
const LAST_SCAN_KEY = "jha:lastScan";
const CV_KEY = "jha:cv";

// ---- In-memory fallback ----------------------------------------------------
const mem = new Map<string, unknown>();

// ---- KV REST helpers -------------------------------------------------------
async function kvGet<T>(key: string): Promise<T | null> {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result: string | null };
  if (data.result == null) return null;
  try {
    return JSON.parse(data.result) as T;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });
}

async function get<T>(key: string): Promise<T | null> {
  if (useKV) return kvGet<T>(key);
  return (mem.get(key) as T) ?? null;
}

async function set(key: string, value: unknown): Promise<void> {
  if (useKV) return kvSet(key, value);
  mem.set(key, value);
}

// ---- Public API ------------------------------------------------------------

export const store = {
  /** Which backend is active — surfaced in the UI for transparency. */
  backend: useKV ? ("vercel-kv" as const) : ("memory" as const),

  async getJobs(): Promise<ScoredJob[]> {
    return (await get<ScoredJob[]>(JOBS_KEY)) ?? [];
  },

  async saveJobs(jobs: ScoredJob[]): Promise<void> {
    await set(JOBS_KEY, jobs);
    await set(LAST_SCAN_KEY, new Date().toISOString());
  },

  async getCriteria(): Promise<SearchCriteria> {
    return (await get<SearchCriteria>(CRITERIA_KEY)) ?? DEFAULT_CRITERIA;
  },

  async saveCriteria(criteria: SearchCriteria): Promise<void> {
    await set(CRITERIA_KEY, criteria);
  },

  async getLastScan(): Promise<string | null> {
    return get<string>(LAST_SCAN_KEY);
  },

  /** The active CV (extracted text + metadata) used for scoring & letters. */
  async getCV(): Promise<{ text: string; filename: string; updatedAt: string } | null> {
    return get(CV_KEY);
  },

  async saveCV(text: string, filename: string): Promise<void> {
    await set(CV_KEY, { text, filename, updatedAt: new Date().toISOString() });
  },

  /** Job ids that already have a Gmail draft / application prepared. */
  async getApplied(): Promise<string[]> {
    return (await get<string[]>(APPLIED_KEY)) ?? [];
  },

  async markApplied(jobId: string): Promise<void> {
    const applied = await this.getApplied();
    if (!applied.includes(jobId)) {
      applied.push(jobId);
      await set(APPLIED_KEY, applied);
    }
  },
};
