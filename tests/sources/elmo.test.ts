import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseElmoJobs, elmoSourceId, type ElmoConfig } from "@/lib/sources/elmo";

/** Capture réelle du portail AGPC Head Office, 2026-09-12. */
const html = readFileSync("tests/fixtures/elmo-agpc-head-office.html", "utf-8");

const cfg: ElmoConfig = {
  host: "grandprix.elmotalent.com.au",
  site: "AustralianGrandPrixCorporationHeadOffice",
  employer: "Australian Grand Prix Corporation",
};

describe("parseElmoJobs", () => {
  it("normalise l'offre réelle du portail, date de clôture comprise", () => {
    const jobs = parseElmoJobs(cfg, html);
    expect(jobs).toHaveLength(1);
    const j = jobs[0];
    expect(j.title).toBe("Communications Coordinator");
    expect(j.employer).toBe("Australian Grand Prix Corporation");
    expect(j.timeType).toBe("Long Term Contract (LTC)");
    expect(j.closesOn).toBe("16/09/2026");
    expect(j.location).toContain("Australian Grand Prix Corporation");
    expect(j.url).toBe(
      "https://grandprix.elmotalent.com.au/careers/" +
        "AustralianGrandPrixCorporationHeadOffice/job/view/89"
    );
  });

  it("identifie l'offre par le locataire, pas par le portail", () => {
    // La même réquisition est publiée sur les deux portails AGPC. Elle doit
    // produire un identifiant unique, sinon elle est alertée deux fois.
    const events: ElmoConfig = { ...cfg, site: "AustralianGrandPrixCorporationEvents" };
    const fromHeadOffice = parseElmoJobs(cfg, html)[0];
    const fromEvents = parseElmoJobs(events, html)[0];

    expect(fromHeadOffice.id).toBe("elmo:grandprix:89");
    expect(fromEvents.id).toBe(fromHeadOffice.id);
    // La santé de chaque portail reste suivie séparément.
    expect(elmoSourceId(events)).not.toBe(elmoSourceId(cfg));
  });

  it("échoue bruyamment si la page change de forme", () => {
    expect(() => parseElmoJobs(cfg, "<html><body>Nothing here</body></html>")).toThrow(
      /section-list/
    );
  });

  it("échoue si le nombre d'offres lues ne correspond pas au compteur affiché", () => {
    // Le lien est cassé mais le compteur annonce toujours une offre : c'est le
    // symptôme d'un changement de balisage, pas d'un board vide.
    const broken = html.replace(/href="\/careers\/[^"]*\/job\/view\/\d+"/g, 'href="#"');
    expect(() => parseElmoJobs(cfg, broken)).toThrow(/incohérente/);
  });

  it("accepte un portail réel sans aucune offre ouverte", () => {
    const empty = html
      .replace(/<li class="list-group-item"[\s\S]*?<\/li>/g, "")
      .replace(/1 - 1 of 1 jobs shown/, "0 - 0 of 0 jobs shown");
    expect(parseElmoJobs(cfg, empty)).toEqual([]);
  });
});
