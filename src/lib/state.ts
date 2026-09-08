/**
 * État du veilleur, persisté en JSON sur la branche `data`.
 *
 * Contient les identifiants d'offres déjà vues — c'est cette liste qui permet
 * de distinguer une offre nouvelle d'une offre déjà signalée — et la santé de
 * chaque source, pour alerter quand un connecteur casse.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface SourceHealth {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  consecutiveFailures: number;
}

export interface WatchState {
  version: 1;
  lastRunAt: string | null;
  /** Identifiants de toutes les offres déjà rencontrées, tous employeurs confondus. */
  knownJobIds: string[];
  sourceHealth: Record<string, SourceHealth>;
}

export function emptyState(): WatchState {
  return { version: 1, lastRunAt: null, knownJobIds: [], sourceHealth: {} };
}

/** Lit l'état. Un fichier absent ou illisible donne un état vide, jamais une erreur. */
export async function loadState(path: string): Promise<WatchState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf-8")) as Partial<WatchState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.knownJobIds)) return emptyState();
    return {
      version: 1,
      lastRunAt: parsed.lastRunAt ?? null,
      knownJobIds: parsed.knownJobIds,
      sourceHealth: parsed.sourceHealth ?? {},
    };
  } catch {
    return emptyState();
  }
}

export async function saveState(path: string, state: WatchState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

function health(state: WatchState, sourceId: string): SourceHealth {
  return (
    state.sourceHealth[sourceId] ?? {
      lastSuccessAt: null, lastErrorAt: null, consecutiveFailures: 0,
    }
  );
}

export function recordSuccess(state: WatchState, sourceId: string, now: string): WatchState {
  const h = health(state, sourceId);
  return {
    ...state,
    sourceHealth: {
      ...state.sourceHealth,
      [sourceId]: { ...h, lastSuccessAt: now, consecutiveFailures: 0 },
    },
  };
}

export function recordFailure(state: WatchState, sourceId: string, now: string): WatchState {
  const h = health(state, sourceId);
  return {
    ...state,
    sourceHealth: {
      ...state.sourceHealth,
      [sourceId]: { ...h, lastErrorAt: now, consecutiveFailures: h.consecutiveFailures + 1 },
    },
  };
}
