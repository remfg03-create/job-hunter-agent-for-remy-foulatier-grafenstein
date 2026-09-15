import { describe, it, expect } from "vitest";
import { PROFILES } from "@/lib/profiles";

/**
 * Ce fichier existe pour une raison précise : une constante déclarée après son
 * utilisation a traversé tsc et toute la suite de tests sans être vue, parce
 * qu'aucun test n'importait le module des profils. L'erreur ne serait apparue
 * qu'à l'exécution, en production.
 */
describe("PROFILES", () => {
  it("se charge sans erreur d'initialisation", () => {
    expect(PROFILES.length).toBeGreaterThan(0);
  });

  it("donne à chaque profil un identifiant et un destinataire uniques", () => {
    const ids = PROFILES.map((p) => p.id);
    const envs = PROFILES.map((p) => p.recipientEnv);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(envs).size).toBe(envs.length);
  });

  it("donne à chaque cible un identifiant unique au sein d'un profil", () => {
    for (const p of PROFILES) {
      const ids = p.targets.map((t) => t.id);
      expect(new Set(ids).size, `profil ${p.id}`).toBe(ids.length);
    }
  });

  it("ne surveille les employeurs nommés que pour des stages chez Matthieu", () => {
    const m = PROFILES.find((p) => p.id === "matthieu")!;
    const named = m.targets.filter((t) => t.type !== "adzuna");
    expect(named.length).toBeGreaterThan(0);
    for (const t of named) {
      expect(t.screening?.requireAny, `cible ${t.id}`).toContain("intern");
    }
  });

  it("aligne Virgile sur Rémy, sauf l'allemand qu'il ne parle pas", () => {
    const get = (id: string) => PROFILES.find((p) => p.id === id)!;
    const adz = (id: string) => {
      const t = get(id).targets.find((x) => x.type === "adzuna");
      return t && t.type === "adzuna" ? t.adzuna : null;
    };
    expect(adz("virgile")!.titleQueries).toEqual(adz("remy")!.titleQueries);
    expect(adz("remy")!.bodyQueries).toContain("german speaking");
    expect(adz("virgile")!.bodyQueries).not.toContain("german speaking");
  });
});
