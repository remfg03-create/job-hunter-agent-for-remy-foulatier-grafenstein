import { describe, it, expect } from "vitest";
import { WATCHLIST } from "@/lib/watchlist";

describe("WATCHLIST", () => {
  it("n'est pas vide", () => {
    expect(WATCHLIST.length).toBeGreaterThan(0);
  });

  it("a des identifiants de cible uniques", () => {
    expect(new Set(WATCHLIST.map((t) => t.id)).size).toBe(WATCHLIST.length);
  });

  it("contient Tennis Australia, le seul identifiant validé à ce jour", () => {
    const ta = WATCHLIST.find((t) => t.id === "tennis-australia");
    expect(ta).toBeDefined();
    expect(ta!.workday).toEqual({
      tenant: "tennis", site: "ta_careers", employer: "Tennis Australia",
    });
  });

  it("ne déclare que des cibles de type workday dans cette version", () => {
    for (const t of WATCHLIST) expect(t.type).toBe("workday");
  });
});
