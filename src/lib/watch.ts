/**
 * Orchestration d'un passage de veille :
 * sources → détection de nouveauté → santé des sources → sauvegarde de l'état.
 *
 * L'envoi de l'alerte est laissé à l'appelant (script CLI), pour que le runner
 * reste testable sans réseau ni identifiants Gmail.
 */

import { WATCHLIST, type WatchTarget } from "@/lib/watchlist";
import { fetchWorkdayJobs } from "@/lib/sources/workday";
import type { JobPosting } from "@/lib/sources/types";
import {
  loadState, saveState, recordSuccess, recordFailure, type WatchState,
} from "@/lib/state";
import { findNewPostings, applyPostings } from "@/lib/diff";

/** Nombre d'échecs consécutifs avant de déclarer une source cassée. */
export const BROKEN_AFTER_FAILURES = 3;

export type Fetcher = (target: WatchTarget) => Promise<JobPosting[]>;

export interface WatchRunResult {
  newPostings: JobPosting[];
  /** Sources ayant atteint le seuil d'échecs consécutifs. */
  brokenSources: string[];
  state: WatchState;
}

const defaultFetcher: Fetcher = (target) => fetchWorkdayJobs(target.workday);

export async function runWatch(opts: {
  statePath: string;
  now?: string;
  targets?: WatchTarget[];
  fetcher?: Fetcher;
}): Promise<WatchRunResult> {
  const now = opts.now ?? new Date().toISOString();
  const targets = opts.targets ?? WATCHLIST;
  const fetcher = opts.fetcher ?? defaultFetcher;

  let state = await loadState(opts.statePath);
  const collected: JobPosting[] = [];
  const broken: string[] = [];

  for (const target of targets) {
    const sourceId = `workday:${target.workday.tenant}`;
    try {
      collected.push(...(await fetcher(target)));
      state = recordSuccess(state, sourceId, now);
    } catch (err) {
      console.warn(`[watch] ${sourceId} en échec — ${(err as Error).message}`);
      state = recordFailure(state, sourceId, now);
      if (state.sourceHealth[sourceId].consecutiveFailures >= BROKEN_AFTER_FAILURES) {
        broken.push(sourceId);
      }
    }
  }

  const newPostings = findNewPostings(state, collected);
  state = applyPostings(state, collected, now);
  await saveState(opts.statePath, state);

  return { newPostings, brokenSources: broken, state };
}
