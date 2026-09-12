import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWatch } from "@/lib/watch";
import { loadState } from "@/lib/state";
import type { JobPosting } from "@/lib/sources/types";
import type { WatchTarget } from "@/lib/watchlist";

const ONE_TARGET: WatchTarget = {
  id: "tennis-australia", employer: "Tennis Australia", type: "workday",
  workday: { tenant: "tennis", site: "ta_careers", employer: "Tennis Australia" },
  priority: "high", geo: "multi-city",
};

const NOW = "2026-09-07T10:00:00.000Z";
const statePath = () => join(mkdtempSync(join(tmpdir(), "w-")), "state.json");
const job = (id: string): JobPosting => ({
  id, source: "workday:tennis", employer: "Tennis Australia",
  title: `Poste ${id}`, location: "Melbourne VIC", url: `https://example.test/${id}`,
});

describe("runWatch", () => {
  it("signale toutes les offres au premier passage", async () => {
    const r = await runWatch({
      statePath: statePath(), now: NOW,
      fetcher: async () => [job("a"), job("b")],
    });
    expect(r.newPostings.map((j) => j.id)).toEqual(["a", "b"]);
    expect(r.brokenSources).toEqual([]);
  });

  it("ne resignale rien au second passage identique", async () => {
    const p = statePath();
    const fetcher = async () => [job("a")];
    await runWatch({ statePath: p, now: NOW, fetcher });
    const second = await runWatch({ statePath: p, now: NOW, fetcher });
    expect(second.newPostings).toEqual([]);
  });

  it("persiste l'état sur disque entre deux passages", async () => {
    const p = statePath();
    await runWatch({ statePath: p, now: NOW, fetcher: async () => [job("a")] });
    expect((await loadState(p)).knownJobIds).toEqual(["a"]);
  });

  it("continue malgré l'échec d'une source et la déclare cassée après 3 échecs", async () => {
    const p = statePath();
    const failing = async () => { throw new Error("HTTP 503"); };
    // Cibles épinglées : le test porte sur le seuil d'échecs, pas sur le
    // contenu de la watchlist de production, qui évolue.
    const targets = [ONE_TARGET];
    let r = await runWatch({ statePath: p, now: NOW, targets, fetcher: failing });
    expect(r.brokenSources).toEqual([]);
    r = await runWatch({ statePath: p, now: NOW, targets, fetcher: failing });
    expect(r.brokenSources).toEqual([]);
    r = await runWatch({ statePath: p, now: NOW, targets, fetcher: failing });
    expect(r.brokenSources).toEqual(["workday:tennis"]);
  });

  it("n'invente jamais d'offre quand une source échoue", async () => {
    const r = await runWatch({
      statePath: statePath(), now: NOW,
      fetcher: async () => { throw new Error("HTTP 503"); },
    });
    expect(r.newPostings).toEqual([]);
  });
});
