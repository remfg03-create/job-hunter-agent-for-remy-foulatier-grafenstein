/**
 * Détection de nouveauté.
 *
 * Une offre est « nouvelle » si son identifiant n'apparaît pas dans l'état.
 * Les identifiants ne sont jamais retirés de l'état : une offre qui disparaît
 * du board puis réapparaît ne doit pas déclencher une seconde alerte.
 */

import type { JobPosting } from "@/lib/sources/types";
import type { WatchState } from "@/lib/state";

export function findNewPostings(state: WatchState, postings: JobPosting[]): JobPosting[] {
  const known = new Set(state.knownJobIds);
  const seen = new Set<string>();
  const fresh: JobPosting[] = [];
  for (const p of postings) {
    if (known.has(p.id) || seen.has(p.id)) continue;
    seen.add(p.id);
    fresh.push(p);
  }
  return fresh;
}

export function applyPostings(
  state: WatchState,
  postings: JobPosting[],
  now: string
): WatchState {
  const ids = new Set(state.knownJobIds);
  for (const p of postings) ids.add(p.id);
  return { ...state, knownJobIds: [...ids], lastRunAt: now };
}
