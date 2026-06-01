/**
 * Indeed scraper.
 *
 * Indeed is protected by Cloudflare and almost always blocks server-side bots,
 * so in practice this resolves to the sample fallback. We still attempt a real
 * fetch of the mobile results page and parse the embedded JSON when reachable,
 * which keeps the scraping logic genuine and ready if run from an allowed IP.
 */

import type { SearchCriteria } from "@/lib/config";
import type { RawJob } from "./types";
import { BROWSER_HEADERS, buildQuery, fetchWithTimeout, matchesCriteria, stripHtml } from "./util";

interface IndeedResult {
  jobkey?: string;
  title?: string;
  company?: string;
  formattedLocation?: string;
  snippet?: string;
  link?: string;
}

export async function scrapeIndeed(criteria: SearchCriteria): Promise<RawJob[]> {
  const q = encodeURIComponent(buildQuery(criteria));
  const loc = encodeURIComponent(criteria.locations[0] || "");
  // Berlin -> .de, Paris -> .fr; default to .fr.
  const tld = /berlin/i.test(criteria.locations[0] || "") ? "de" : "fr";
  const url = `https://${tld}.indeed.com/jobs?q=${q}&l=${loc}`;

  const res = await fetchWithTimeout(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`Indeed ${res.status}`);
  const html = await res.text();

  // Indeed embeds results as JSON in a window._initialData / mosaic provider blob.
  const m = html.match(/window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{.+?\});/s);
  if (!m) throw new Error("Indeed: no embedded results (likely blocked)");

  const blob = JSON.parse(m[1]) as { metaData?: { mosaicProviderJobCardsModel?: { results?: IndeedResult[] } } };
  const results = blob.metaData?.mosaicProviderJobCardsModel?.results ?? [];

  const jobs: RawJob[] = results.slice(0, 20).map((r, i) => ({
    id: `indeed-${r.jobkey || i}`,
    title: r.title || "Job",
    company: r.company || "Company",
    location: r.formattedLocation || criteria.locations[0] || "",
    source: "indeed",
    url: r.jobkey ? `https://${tld}.indeed.com/viewjob?jk=${r.jobkey}` : `https://${tld}.indeed.com`,
    description: stripHtml(r.snippet || "").slice(0, 1500),
    contractType: "permanent",
  }));

  return jobs.filter((j) => matchesCriteria(j, criteria));
}
