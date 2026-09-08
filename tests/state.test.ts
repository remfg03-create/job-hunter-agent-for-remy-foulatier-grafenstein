import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  emptyState, loadState, saveState, recordSuccess, recordFailure,
} from "@/lib/state";

const NOW = "2026-09-07T10:00:00.000Z";

describe("state", () => {
  it("retourne un état vide quand le fichier n'existe pas", async () => {
    const s = await loadState(join(mkdtempSync(join(tmpdir(), "w-")), "absent.json"));
    expect(s.knownJobIds).toEqual([]);
    expect(s.lastRunAt).toBeNull();
    expect(s.version).toBe(1);
  });

  it("relit à l'identique ce qu'il a écrit", async () => {
    const p = join(mkdtempSync(join(tmpdir(), "w-")), "state.json");
    const s = { ...emptyState(), lastRunAt: NOW, knownJobIds: ["workday:tennis:R1"] };
    await saveState(p, s);
    expect(await loadState(p)).toEqual(s);
  });

  it("retourne un état vide plutôt que de planter sur un JSON corrompu", async () => {
    const p = join(mkdtempSync(join(tmpdir(), "w-")), "state.json");
    writeFileSync(p, "{ pas du json");
    expect((await loadState(p)).knownJobIds).toEqual([]);
  });

  it("remet le compteur d'échecs à zéro sur un succès", () => {
    let s = emptyState();
    s = recordFailure(s, "workday:tennis", NOW);
    s = recordFailure(s, "workday:tennis", NOW);
    expect(s.sourceHealth["workday:tennis"].consecutiveFailures).toBe(2);
    s = recordSuccess(s, "workday:tennis", NOW);
    expect(s.sourceHealth["workday:tennis"].consecutiveFailures).toBe(0);
    expect(s.sourceHealth["workday:tennis"].lastSuccessAt).toBe(NOW);
  });

  it("incrémente les échecs consécutifs et horodate le dernier", () => {
    let s = emptyState();
    s = recordFailure(s, "workday:tennis", NOW);
    expect(s.sourceHealth["workday:tennis"].lastErrorAt).toBe(NOW);
    expect(s.sourceHealth["workday:tennis"].lastSuccessAt).toBeNull();
  });

  it("ne mute pas l'état passé en argument", () => {
    const s = emptyState();
    recordFailure(s, "workday:tennis", NOW);
    expect(s.sourceHealth["workday:tennis"]).toBeUndefined();
  });
});
