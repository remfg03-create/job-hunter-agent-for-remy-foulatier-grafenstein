/**
 * Anthropic client factory.
 *
 * Returns null when no API key is configured so the rest of the app can degrade
 * gracefully (the scan still runs and lists jobs; only AI scoring/writing is
 * skipped with a clear message).
 */

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null | undefined;

export function getAnthropic(): Anthropic | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  client = apiKey ? new Anthropic({ apiKey }) : null;
  return client;
}

export function hasAI(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Run async tasks with a bounded concurrency (avoids hammering the API). */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
