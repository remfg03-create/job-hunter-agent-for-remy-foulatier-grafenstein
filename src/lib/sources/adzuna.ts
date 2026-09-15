/**
 * Connecteur Adzuna (Australie).
 *
 * Les employeurs surveillés un par un ne couvrent pas le périmètre réel de
 * Rémy : catering événementiel, festivals, cinéma, marketing, missions, et les
 * postes qui exigent un francophone ou un germanophone. Aucun de ces critères
 * n'est un employeur ; ce sont des caractéristiques d'annonce. D'où un flux
 * large interrogé par mots-clés.
 *
 * Clé gratuite, API documentée et autorisant explicitement cet usage, à la
 * différence de SEEK et Indeed qui renvoient 403.
 *
 * Vérifié le 2026-09-14 : « event coordinator » à Melbourne remonte 131 offres.
 */

import type { JobPosting } from "./types";

export interface AdzunaConfig {
  appId: string;
  appKey: string;
  /**
   * Termes cherchés dans le TITRE uniquement.
   *
   * Le paramètre `what` d'Adzuna cherche dans tout le texte de l'annonce :
   * « event coordinator » remontait ainsi des postes de réceptionniste et de
   * technicien dont la fiche mentionnait un événement en passant. `title_only`
   * supprime ce bruit.
   */
  titleQueries: string[];
  /**
   * Termes cherchés dans le texte complet, là où c'est justement l'intention :
   * une annonce qui exige un francophone le dit dans le corps, pas dans le
   * titre du poste.
   */
  bodyQueries?: string[];
  where?: string;
  /**
   * Fenêtre de fraîcheur en jours. Sans elle, chaque passage rapatrie des
   * milliers d'annonces anciennes ; la veille doit signaler ce qui vient de
   * paraître, pas rejouer l'historique.
   */
  maxDaysOld?: number;
  resultsPerQuery?: number;
}

interface AdzunaResult {
  id?: string;
  title?: string;
  created?: string;
  redirect_url?: string;
  contract_type?: string;
  contract_time?: string;
  description?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
}

export function parseAdzunaJobs(query: string, payload: unknown): JobPosting[] {
  const results = (payload as { results?: unknown })?.results;
  if (!Array.isArray(results)) {
    throw new Error(`Réponse Adzuna inattendue pour « ${query} » : results absent`);
  }

  const jobs: JobPosting[] = [];
  for (const raw of results as AdzunaResult[]) {
    if (!raw.id) continue; // sans identifiant, pas de déduplication fiable
    jobs.push({
      id: `adzuna:${raw.id}`,
      source: "adzuna:au",
      employer: raw.company?.display_name?.trim() || "Employeur non précisé",
      title: raw.title?.trim() || "Sans titre",
      location: raw.location?.display_name?.trim() || "",
      url: raw.redirect_url || "",
      postedOn: raw.created,
      timeType: [raw.contract_time, raw.contract_type].filter(Boolean).join(", ") || undefined,
      description: raw.description?.trim() || undefined,
    });
  }
  return jobs;
}

function searchUrl(cfg: AdzunaConfig, query: string, titleOnly: boolean): string {
  const params = new URLSearchParams({
    app_id: cfg.appId,
    app_key: cfg.appKey,
    results_per_page: String(cfg.resultsPerQuery ?? 20),
    what_phrase: query,
    where: cfg.where ?? "melbourne",
    max_days_old: String(cfg.maxDaysOld ?? 7),
    sort_by: "date",
    "content-type": "application/json",
  });
  if (titleOnly) params.set("title_only", query);
  return `https://api.adzuna.com/v1/api/jobs/au/search/1?${params}`;
}

/**
 * Interroge chaque terme et retourne les offres dédupliquées.
 *
 * Une requête en échec n'interrompt pas les autres, mais si toutes échouent
 * l'erreur remonte : une source muette ne doit jamais passer pour une source
 * sans résultat.
 */
/**
 * Cache d'un passage.
 *
 * Deux profils partagent l'essentiel de leurs termes. Sans cache, trois profils
 * feraient plus de deux cents appels par jour et Adzuna a déjà répondu 503 lors
 * d'une session de mise au point. Le cache est vidé à chaque processus, donc
 * jamais de données périmées d'un passage à l'autre.
 */
const runCache = new Map<string, JobPosting[]>();

export function clearAdzunaCache(): void {
  runCache.clear();
}

export async function fetchAdzunaJobs(cfg: AdzunaConfig): Promise<JobPosting[]> {
  const seen = new Set<string>();
  const jobs: JobPosting[] = [];
  const failures: string[] = [];

  const all = [
    ...cfg.titleQueries.map((q) => ({ q, titleOnly: true })),
    ...(cfg.bodyQueries ?? []).map((q) => ({ q, titleOnly: false })),
  ];

  for (const { q: query, titleOnly } of all) {
    const cacheKey = `${cfg.where ?? "melbourne"}|${cfg.maxDaysOld ?? 7}|${titleOnly}|${query}`;
    const cached = runCache.get(cacheKey);
    if (cached) {
      for (const job of cached) {
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        jobs.push(job);
      }
      continue;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(searchUrl(cfg, query, titleOnly), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Adzuna a répondu ${res.status}`);
      const found = parseAdzunaJobs(query, await res.json());
      runCache.set(cacheKey, found);
      for (const job of found) {
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        jobs.push(job);
      }
    } catch (err) {
      failures.push(`${query} (${(err as Error).message})`);
    } finally {
      clearTimeout(timer);
    }
  }

  if (failures.length === all.length) {
    throw new Error(`Adzuna : toutes les requêtes ont échoué — ${failures.join("; ")}`);
  }
  if (failures.length) {
    console.warn(`[adzuna] requêtes en échec : ${failures.join("; ")}`);
  }
  return jobs;
}
