/**
 * Scraper orchestrator.
 *
 * Runs all 5 site scrapers in parallel. For each source: if the live fetch
 * returns nothing (blocked / changed markup / error), we substitute the bundled
 * sample jobs for that source so a scan always yields results. De-duplicates by
 * id and caps the total.
 */

import type { SearchCriteria } from "@/lib/config";
import { JOB_SITES, MAX_JOBS_PER_SCAN } from "@/lib/config";
import type { RawJob } from "./types";
import { safely } from "./util";
import { sampleJobsFor } from "./fallback";
import { scrapeWelcomeToTheJungle } from "./welcome-to-the-jungle";
import { scrapeApec } from "./apec";
import { scrapeIndeed } from "./indeed";
import { scrapeLinkedIn } from "./linkedin";
import { scrapeHelloWork } from "./hellowork";

const SCRAPERS: Record<string, (c: SearchCriteria) => Promise<RawJob[]>> = {
  "welcome-to-the-jungle": scrapeWelcomeToTheJungle,
  apec: scrapeApec,
  indeed: scrapeIndeed,
  linkedin: scrapeLinkedIn,
  hellowork: scrapeHelloWork,
};

export interface ScrapeReport {
  jobs: RawJob[];
  /** Per-source counts so the UI can show what was live vs. fallback. */
  perSource: { source: string; name: string; live: number; sample: number }[];
}

export async function scrapeAll(criteria: SearchCriteria): Promise<ScrapeReport> {
  const results = await Promise.all(
    JOB_SITES.map(async (site) => {
      const scraper = SCRAPERS[site.id];
      const live = scraper ? await safely(() => scraper(criteria), site.id) : [];
      if (live.length > 0) {
        return { site, jobs: live, live: live.length, sample: 0 };
      }
      const sample = await sampleJobsFor(site.id);
      return { site, jobs: sample, live: 0, sample: sample.length };
    })
  );

  // Flatten + de-duplicate by id.
  const byId = new Map<string, RawJob>();
  for (const r of results) {
    for (const job of r.jobs) byId.set(job.id, job);
  }

  const jobs = [...byId.values()].slice(0, MAX_JOBS_PER_SCAN);
  const perSource = results.map((r) => ({
    source: r.site.id,
    name: r.site.name,
    live: r.live,
    sample: r.sample,
  }));

  return { jobs, perSource };
}
