/**
 * LinkedIn scraper.
 *
 * Uses LinkedIn's public "jobs-guest" endpoint that returns HTML job-card
 * snippets without authentication. It is aggressively rate-limited, so this is
 * a best-effort attempt that falls back to sample data on any block.
 */

import type { SearchCriteria } from "@/lib/config";
import type { RawJob } from "./types";
import { BROWSER_HEADERS, buildQuery, fetchWithTimeout, matchesCriteria, stripHtml } from "./util";

export async function scrapeLinkedIn(criteria: SearchCriteria): Promise<RawJob[]> {
  const keywords = encodeURIComponent(buildQuery(criteria));
  const location = encodeURIComponent(criteria.locations[0] || "");
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${keywords}&location=${location}&start=0`;

  const res = await fetchWithTimeout(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`LinkedIn ${res.status}`);
  const html = await res.text();

  // Each result is a <li> with a card. Pull out title, company, location, link.
  const cards = html.split("<li>").slice(1);
  const jobs: RawJob[] = [];

  for (const card of cards.slice(0, 20)) {
    const title = match(card, /job-search-card__title"?>?\s*([^<]+)</i) ||
      match(card, /base-search-card__title">\s*([^<]+)</i);
    const company = match(card, /hidden-nested-link"?>?\s*([^<]+)</i) ||
      match(card, /base-search-card__subtitle">\s*<a[^>]*>\s*([^<]+)</i);
    const loc = match(card, /job-search-card__location">\s*([^<]+)</i);
    const link = match(card, /href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/i);
    const idMatch = link && match(link, /view\/[^\d]*(\d+)/);

    if (!title || !link) continue;
    jobs.push({
      id: `linkedin-${idMatch || jobs.length}`,
      title: stripHtml(title),
      company: stripHtml(company || "Company"),
      location: stripHtml(loc || criteria.locations[0] || ""),
      source: "linkedin",
      url: link,
      description: `${stripHtml(title)} at ${stripHtml(company || "")} — ${stripHtml(loc || "")}. Open the LinkedIn posting for the full description.`,
      contractType: "permanent",
    });
  }

  return jobs.filter((j) => matchesCriteria(j, criteria));
}

function match(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}
