import { describe, it, expect } from "vitest";
import { WATCHLIST } from "@/lib/watchlist";

describe("WATCHLIST", () => {
  it("n'est pas vide", () => {
    expect(WATCHLIST.length).toBeGreaterThan(0);
  });

  it("a des identifiants de cible uniques", () => {
    expect(new Set(WATCHLIST.map((t) => t.id)).size).toBe(WATCHLIST.length);
  });

  it("porte une configuration cohérente avec le type déclaré de chaque cible", () => {
    for (const t of WATCHLIST) {
      if (t.type === "workday") {
        expect(t.workday.tenant).toBeTruthy();
        expect(t.workday.site).toBeTruthy();
      } else if (t.type === "elmo") {
        expect(t.elmo.host).toBeTruthy();
        expect(t.elmo.site).toBeTruthy();
      } else {
        expect(t.adzuna.titleQueries.length).toBeGreaterThan(0);
      }
      expect(t.employer).toBeTruthy();
    }
  });

  it("contient Tennis Australia avec l'identifiant Workday validé", () => {
    const ta = WATCHLIST.find((t) => t.id === "tennis-australia");
    expect(ta?.type).toBe("workday");
    expect(ta && ta.type === "workday" ? ta.workday : null).toEqual({
      tenant: "tennis", site: "ta_careers", employer: "Tennis Australia",
    });
  });

  it("surveille les deux portails AGPC, dont celui des postes événementiels", () => {
    const agpc = WATCHLIST.flatMap((t) =>
      t.type === "elmo" && t.elmo.host.startsWith("grandprix.") ? [t] : []
    );
    expect(agpc).toHaveLength(2);
    const sites = agpc.map((t) => (t.type === "elmo" ? t.elmo.site : ""));
    expect(sites).toContain("AustralianGrandPrixCorporationHeadOffice");
    expect(sites).toContain("AustralianGrandPrixCorporationEvents");
    // L'ouverture de la campagne du Grand Prix est l'événement à ne pas manquer.
    for (const t of agpc) expect(t.priority).toBe("high");
  });
});
