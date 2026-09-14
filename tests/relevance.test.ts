import { describe, it, expect } from "vitest";
import { screen, isInMelbourne, isOffProfile, isTooSenior } from "@/lib/relevance";
import type { JobPosting } from "@/lib/sources/types";

const job = (title: string, location: string): JobPosting => ({
  id: `x:${title}`, source: "test", employer: "Test", title, location,
  url: "https://example.test",
});

describe("isInMelbourne", () => {
  it("reconnaît les sites melbournois, y compris par leur nom d'enceinte", () => {
    for (const l of ["Melbourne VIC", "Melbourne Park", "Albert Park", "St Kilda VIC"]) {
      expect(isInMelbourne(l)).toBe(true);
    }
  });

  it("écarte les autres villes australiennes", () => {
    for (const l of ["Sydney NSW", "Brisbane QLD", "Adelaide SA", "Darwin"]) {
      expect(isInMelbourne(l)).toBe(false);
    }
  });

  it("n'accepte pas le seul code d'État VIC", () => {
    // Geelong et Phillip Island sont dans le Victoria mais hors périmètre.
    expect(isInMelbourne("Geelong VIC")).toBe(false);
  });
});

describe("isOffProfile", () => {
  it("écarte les métiers techniques, juridiques et de santé", () => {
    expect(isOffProfile("Domain Architect")).toBe(true);
    expect(isOffProfile("Integrity Paralegal")).toBe(true);
    expect(isOffProfile("Safety and Compliance Lead")).toBe(true);
  });

  it("conserve tout titre non reconnu plutôt que de le rejeter", () => {
    for (const t of ["Site Supervisor", "Accommodation Officer", "Event Crew", "Barista"]) {
      expect(isOffProfile(t)).toBe(false);
    }
  });
});

describe("screen", () => {
  it("filtre sur la ville quand l'employeur recrute dans plusieurs villes", () => {
    const r = screen(
      [job("Site Supervisor", "Melbourne Park"), job("Events Manager", "Sydney NSW")],
      { assumeMelbourne: false }
    );
    expect(r.kept.map((p) => p.title)).toEqual(["Site Supervisor"]);
    expect(r.rejected[0].reason).toBe("hors-zone");
  });

  it("ne filtre pas sur la ville pour un employeur entièrement melbournois", () => {
    // Cas réel : l'AGPC inscrit « ... Head Office » dans le champ lieu.
    const r = screen(
      [job("Communications Coordinator", "Australian Grand Prix Corporation Head Office")],
      { assumeMelbourne: true }
    );
    expect(r.kept).toHaveLength(1);
    expect(r.rejected).toHaveLength(0);
  });

  it("écarte un métier hors profil même chez un employeur melbournois", () => {
    const r = screen([job("Software Engineer", "Melbourne VIC")], { assumeMelbourne: true });
    expect(r.kept).toHaveLength(0);
    expect(r.rejected[0].reason).toBe("hors-profil");
  });
});

describe("isTooSenior", () => {
  it("écarte les postes de direction", () => {
    expect(isTooSenior("Head of Data, Analytics and Insights")).toBe(true);
    expect(isTooSenior("Director of Events")).toBe(true);
    expect(isTooSenior("General Manager, Venues")).toBe(true);
  });

  it("conserve Lead et Manager, accessibles à un profil junior", () => {
    // L'Events Lead des Saints, auquel Rémy a candidaté, doit passer.
    expect(isTooSenior("Events Lead")).toBe(false);
    expect(isTooSenior("Event Manager")).toBe(false);
  });
});

describe("marketing", () => {
  it("laisse passer les postes marketing, qui intéressent Rémy", () => {
    for (const t of ["Marketing Coordinator", "Marketing Analyst", "Brand Activation Officer"]) {
      expect(isOffProfile(t)).toBe(false);
    }
  });
});
