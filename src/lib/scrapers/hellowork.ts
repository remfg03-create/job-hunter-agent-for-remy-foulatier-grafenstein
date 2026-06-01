/**
 * HelloWork scraper.
 *
 * Fetches the public search results page and parses the job cards out of the
 * HTML. Best-effort — falls back to sample data if the markup changes or the
 * request is blocked.
 */

import type { SearchCriteria } from "@/lib/config";
import type { RawJob } from "./types";
import { BROWSER_HEADERS, buildQuery, fetchWithTimeout, matchesCriteria, stripHtml } from "./util";

export async function scrapeHelloWork(criteria: SearchCriteria): Promise<RawJob[]> {
  const q = encodeURIComponent(buildQuery(criteria));
  const loc = encodeURIComponent(criteria.locations.find((l) => /paris/i.test(l)) || "Paris");
  const url = `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${q}&l=${loc}`;

  const res = await fetchWithTimeout(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`HelloWork ${res.status}`);
  const html = await res.text();

  // HelloWork renders job cards as <li ... data-id-storage-target="item"> blocks
  // with an <a> title link. Parse defensively.
  const anchors = [...html.matchAll(/<a[^>]+href="(\/fr-fr\/emplois\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/g)];
  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  for (const a of anchors) {
    const href = a[1];
    const title = stripHtml(a[2]);
    if (!title || title.length < 4 || seen.has(href)) continue;
    seen.add(href);
    const idMatch = href.match(/-(\d+)\.html/);
    jobs.push({
      id: `hellowork-${idMatch?.[1] || jobs.length}`,
      title,
      company: "Voir l'offre",
      location: criteria.locations.find((l) => /paris/i.test(l)) || "Paris",
      source: "hellowork",
      url: `https://www.hellowork.com${href}`,
      description: `${title} — offre HelloWork. Ouvrez l'annonce pour la description complète.`,
      contractType: /cdd|stage|alternance/i.test(title) ? "fixed-term" : "permanent",
    });
    if (jobs.length >= 20) break;
  }

  return jobs.filter((j) => matchesCriteria(j, criteria));
}
