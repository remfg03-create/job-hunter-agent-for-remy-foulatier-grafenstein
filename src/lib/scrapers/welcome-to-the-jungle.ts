/**
 * Welcome to the Jungle scraper.
 *
 * WTTJ's search is powered by Algolia. We query their public Algolia index with
 * the role keywords + target cities. Public Algolia keys rotate, so this is a
 * best-effort attempt — on any failure the index falls back to sample data.
 */

import type { SearchCriteria } from "@/lib/config";
import type { RawJob } from "./types";
import { BROWSER_HEADERS, buildQuery, fetchWithTimeout, matchesCriteria, stripHtml } from "./util";

const ALGOLIA_APP = "CSEKHVMS53";
const ALGOLIA_KEY = process.env.WTTJ_ALGOLIA_KEY || "02f7e6131bf32d20f5da591208 a5c41 "; // public key (rotates)
const INDEX = "wk_cms_jobs_production";

interface AlgoliaHit {
  objectID?: string;
  name?: string;
  organization?: { name?: string };
  offices?: { city?: string; country?: string }[];
  description?: string;
  contract_type?: string;
  slug?: string;
  reference?: string;
  published_at?: string;
}

export async function scrapeWelcomeToTheJungle(criteria: SearchCriteria): Promise<RawJob[]> {
  const url = `https://${ALGOLIA_APP.toLowerCase()}-dsn.algolia.net/1/indexes/${INDEX}/query`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/json",
      "X-Algolia-Application-Id": ALGOLIA_APP,
      "X-Algolia-API-Key": ALGOLIA_KEY.trim(),
    },
    body: JSON.stringify({
      query: buildQuery(criteria),
      hitsPerPage: 20,
      attributesToRetrieve: [
        "name",
        "organization",
        "offices",
        "description",
        "contract_type",
        "slug",
        "reference",
        "published_at",
      ],
    }),
  });

  if (!res.ok) throw new Error(`Algolia ${res.status}`);
  const data = (await res.json()) as { hits?: AlgoliaHit[] };
  const hits = data.hits ?? [];

  const jobs: RawJob[] = hits.map((h, i) => {
    const office = h.offices?.[0];
    const location = [office?.city, office?.country].filter(Boolean).join(", ") || "France";
    return {
      id: `wttj-${h.reference || h.objectID || h.slug || i}`,
      title: h.name || "Untitled role",
      company: h.organization?.name || "Company",
      location,
      source: "welcome-to-the-jungle",
      url: h.slug
        ? `https://www.welcometothejungle.com/en/companies/${h.organization?.name || ""}/jobs/${h.slug}`
        : "https://www.welcometothejungle.com",
      description: stripHtml(h.description || "").slice(0, 1500),
      contractType: /cdd|fixed|intern|stage/i.test(h.contract_type || "")
        ? "fixed-term"
        : "permanent",
      postedAt: h.published_at,
    };
  });

  return jobs.filter((j) => matchesCriteria(j, criteria));
}
