/**
 * Orchestration d'un passage de veille :
 * sources → détection de nouveauté → santé des sources → sauvegarde de l'état.
 *
 * L'envoi de l'alerte est laissé à l'appelant (script CLI), pour que le runner
 * reste testable sans réseau ni identifiants Gmail.
 */

import { WATCHLIST, type WatchTarget } from "@/lib/watchlist";
import { fetchWorkdayJobs } from "@/lib/sources/workday";
import { fetchElmoJobs, elmoSourceId } from "@/lib/sources/elmo";
import { fetchAdzunaJobs } from "@/lib/sources/adzuna";
import type { JobPosting } from "@/lib/sources/types";
import {
  loadState, saveState, recordSuccess, recordFailure, type WatchState,
} from "@/lib/state";
import { findNewPostings, applyPostings } from "@/lib/diff";
import { screen, type Rejection, type Screening } from "@/lib/relevance";

/** Nombre d'échecs consécutifs avant de déclarer une source cassée. */
export const BROKEN_AFTER_FAILURES = 3;

export type Fetcher = (target: WatchTarget) => Promise<JobPosting[]>;

export interface WatchRunResult {
  newPostings: JobPosting[];
  /** Sources ayant atteint le seuil d'échecs consécutifs. */
  brokenSources: string[];
  /**
   * Offres écartées par le filtre lors de ce passage, avec leur motif.
   * Rapportées pour que le filtrage reste visible et vérifiable : une offre
   * écartée n'entre pas dans l'état, donc un assouplissement du filtre la
   * fera réapparaître au passage suivant.
   */
  rejected: { posting: JobPosting; reason: Rejection }[];
  state: WatchState;
}

/** Clé de santé de la source, stable dans l'état d'un passage à l'autre. */
export function sourceIdOf(target: WatchTarget): string {
  switch (target.type) {
    case "workday": return `workday:${target.workday.tenant}`;
    case "elmo": return elmoSourceId(target.elmo);
    case "adzuna": return "adzuna:au";
  }
}

const defaultFetcher: Fetcher = (target) => {
  switch (target.type) {
    case "workday":
      return fetchWorkdayJobs(target.workday);
    case "elmo":
      return fetchElmoJobs(target.elmo);
    case "adzuna": {
      const appId = process.env.ADZUNA_APP_ID;
      const appKey = process.env.ADZUNA_APP_KEY;
      // Échec bruyant : une source sans clé ne doit pas passer pour une source
      // sans résultat.
      if (!appId || !appKey) {
        throw new Error("ADZUNA_APP_ID ou ADZUNA_APP_KEY absent de l'environnement");
      }
      return fetchAdzunaJobs({ ...target.adzuna, appId, appKey });
    }
  }
};

export async function runWatch(opts: {
  statePath: string;
  now?: string;
  targets?: WatchTarget[];
  /** Filtres de la personne surveillée. Par défaut, ceux de l'événementiel. */
  screening?: Screening;
  fetcher?: Fetcher;
}): Promise<WatchRunResult> {
  const now = opts.now ?? new Date().toISOString();
  const targets = opts.targets ?? WATCHLIST;
  const fetcher = opts.fetcher ?? defaultFetcher;

  let state = await loadState(opts.statePath);
  const collected: JobPosting[] = [];
  const rejected: { posting: JobPosting; reason: Rejection }[] = [];
  const broken: string[] = [];

  for (const target of targets) {
    const sourceId = sourceIdOf(target);
    try {
      const found = await fetcher(target);
      const sorted = screen(found, {
        assumeMelbourne: target.geo === "melbourne",
        screening: opts.screening,
      });
      collected.push(...sorted.kept);
      rejected.push(...sorted.rejected);
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

  return { newPostings, brokenSources: broken, rejected, state };
}
