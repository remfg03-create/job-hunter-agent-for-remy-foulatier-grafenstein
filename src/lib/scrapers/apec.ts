/**
 * APEC scraper.
 *
 * APEC's frontend calls a public JSON search webservice. We POST the role
 * keywords and read back the offer list. Best-effort — falls back to samples.
 */

import type { SearchCriteria } from "@/lib/config";
import type { RawJob } from "./types";
import { BROWSER_HEADERS, buildQuery, fetchWithTimeout, matchesCriteria, stripHtml } from "./util";

interface ApecOffer {
  numeroOffre?: string;
  intitule?: string;
  nomCommercialEtablissement?: string;
  lieuTravail?: string;
  texteHtml?: string;
  typeContrat?: string;
  datePublication?: string;
}

export async function scrapeApec(criteria: SearchCriteria): Promise<RawJob[]> {
  const url = "https://www.apec.fr/cms/webservices/rechercheOffre";
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { ...BROWSER_HEADERS, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      lieux: [],
      motsCles: buildQuery(criteria),
      typesContrat: [],
      pagination: { range: 20, startIndex: 0 },
      sorts: [{ type: "DATE", direction: "DESCENDING" }],
    }),
  });

  if (!res.ok) throw new Error(`APEC ${res.status}`);
  const data = (await res.json()) as { resultats?: ApecOffer[] };
  const offers = data.resultats ?? [];

  const jobs: RawJob[] = offers.map((o, i) => ({
    id: `apec-${o.numeroOffre || i}`,
    title: o.intitule || "Offre",
    company: o.nomCommercialEtablissement || "Entreprise",
    location: o.lieuTravail || "France",
    source: "apec",
    url: o.numeroOffre
      ? `https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/${o.numeroOffre}`
      : "https://www.apec.fr",
    description: stripHtml(o.texteHtml || "").slice(0, 1500),
    contractType: /cdd|déterminée|stage|alternance/i.test(o.typeContrat || "")
      ? "fixed-term"
      : "permanent",
    postedAt: o.datePublication,
  }));

  return jobs.filter((j) => matchesCriteria(j, criteria));
}
