/**
 * Connecteur Workday.
 *
 * Workday expose une API JSON publique et non authentifiée sur ses portails
 * carrières. Validé le 2026-09-07 sur Tennis Australia (19 offres réelles).
 * Générique : paramétré par tenant + site, donc réutilisable pour tout
 * employeur hébergé sur Workday.
 */

import type { JobPosting } from "./types";

export interface WorkdayConfig {
  /** Sous-domaine du portail : "tennis" dans tennis.wd3.myworkdayjobs.com. */
  tenant: string;
  /** Nom du site carrières : "ta_careers". */
  site: string;
  /** Nom lisible de l'employeur, reporté tel quel sur chaque offre. */
  employer: string;
}

interface WorkdayPosting {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  timeType?: string;
}

function base(cfg: WorkdayConfig): string {
  return `https://${cfg.tenant}.wd3.myworkdayjobs.com`;
}

/** Dernier segment de l'externalPath — l'identifiant de réquisition. */
function requisitionId(externalPath: string): string {
  const parts = externalPath.split("/").filter(Boolean);
  return parts[parts.length - 1];
}

export function parseWorkdayJobs(cfg: WorkdayConfig, payload: unknown): JobPosting[] {
  const postings = (payload as { jobPostings?: unknown })?.jobPostings;
  if (!Array.isArray(postings)) {
    throw new Error("Réponse Workday inattendue : jobPostings absent ou non tableau");
  }

  const jobs: JobPosting[] = [];
  for (const raw of postings as WorkdayPosting[]) {
    if (!raw.externalPath) continue; // sans chemin, pas d'URL fiable ni d'identifiant
    jobs.push({
      id: `workday:${cfg.tenant}:${requisitionId(raw.externalPath)}`,
      source: `workday:${cfg.tenant}`,
      employer: cfg.employer,
      title: raw.title?.trim() || "Sans titre",
      location: raw.locationsText?.trim() || "",
      url: `${base(cfg)}/en-US/${cfg.site}${raw.externalPath}`,
      postedOn: raw.postedOn,
      timeType: raw.timeType,
    });
  }
  return jobs;
}

/** Interroge le portail et retourne les offres normalisées. Lève en cas d'échec. */
export async function fetchWorkdayJobs(
  cfg: WorkdayConfig,
  limit = 20
): Promise<JobPosting[]> {
  const url = `${base(cfg)}/wday/cxs/${cfg.tenant}/${cfg.site}/jobs`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit, offset: 0, searchText: "" }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Workday ${cfg.tenant} a répondu ${res.status}`);
    return parseWorkdayJobs(cfg, await res.json());
  } finally {
    clearTimeout(timer);
  }
}
