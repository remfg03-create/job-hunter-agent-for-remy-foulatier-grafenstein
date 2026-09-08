import { describe, it, expect } from "vitest";
import { findNewPostings, applyPostings } from "@/lib/diff";
import { emptyState } from "@/lib/state";
import type { JobPosting } from "@/lib/sources/types";

const NOW = "2026-09-07T10:00:00.000Z";
const job = (id: string): JobPosting => ({
  id, source: "workday:tennis", employer: "Tennis Australia",
  title: `Poste ${id}`, location: "Melbourne VIC",
  url: `https://example.test/${id}`,
});

describe("findNewPostings", () => {
  it("considère tout comme nouveau au tout premier passage", () => {
    expect(findNewPostings(emptyState(), [job("a"), job("b")]).map((j) => j.id))
      .toEqual(["a", "b"]);
  });

  it("ne retourne que ce qui n'a jamais été vu", () => {
    const s = applyPostings(emptyState(), [job("a")], NOW);
    expect(findNewPostings(s, [job("a"), job("b")]).map((j) => j.id)).toEqual(["b"]);
  });

  it("ne signale rien quand rien n'a changé", () => {
    const s = applyPostings(emptyState(), [job("a"), job("b")], NOW);
    expect(findNewPostings(s, [job("a"), job("b")])).toEqual([]);
  });

  it("ne resignale pas une offre disparue puis réapparue", () => {
    let s = applyPostings(emptyState(), [job("a")], NOW);
    s = applyPostings(s, [], NOW);
    expect(findNewPostings(s, [job("a")])).toEqual([]);
  });

  it("dédoublonne les offres remontées deux fois dans le même passage", () => {
    expect(findNewPostings(emptyState(), [job("a"), job("a")]).map((j) => j.id))
      .toEqual(["a"]);
  });
});

describe("applyPostings", () => {
  it("mémorise les identifiants et horodate le passage", () => {
    const s = applyPostings(emptyState(), [job("a"), job("b")], NOW);
    expect(s.knownJobIds.sort()).toEqual(["a", "b"]);
    expect(s.lastRunAt).toBe(NOW);
  });

  it("n'oublie jamais un identifiant déjà connu", () => {
    let s = applyPostings(emptyState(), [job("a")], NOW);
    s = applyPostings(s, [job("b")], NOW);
    expect(s.knownJobIds.sort()).toEqual(["a", "b"]);
  });

  it("n'introduit pas de doublon dans knownJobIds", () => {
    let s = applyPostings(emptyState(), [job("a")], NOW);
    s = applyPostings(s, [job("a")], NOW);
    expect(s.knownJobIds).toEqual(["a"]);
  });

  it("ne mute pas l'état passé en argument", () => {
    const s = emptyState();
    applyPostings(s, [job("a")], NOW);
    expect(s.knownJobIds).toEqual([]);
  });
});
