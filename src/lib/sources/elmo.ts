/**
 * Connecteur ELMO Talent.
 *
 * ELMO héberge les portails carrières de l'Australian Grand Prix Corporation.
 * Contrairement à d'autres ATS, la liste des offres est rendue côté serveur :
 * les liens `job/view/<id>` sont en clair dans le HTML, avec le lieu, le type
 * de contrat et la date de clôture. Aucun navigateur headless n'est nécessaire.
 *
 * Vérifié le 2026-09-12 sur les deux portails AGPC (HeadOffice et Events).
 *
 * Contrôle négatif effectué le 2026-09-12 : un segment de site inventé
 * (`ZzzNotARealSite12345`) renvoie HTTP 404. ELMO valide donc l'identifiant de
 * site, à la différence de SmartRecruiters qui répond 200 / 0 résultat.
 */

import type { JobPosting } from "./types";

export interface ElmoConfig {
  /** Hôte du portail : "grandprix.elmotalent.com.au". */
  host: string;
  /** Segment de site : "AustralianGrandPrixCorporationHeadOffice". */
  site: string;
  /** Nom lisible de l'employeur, reporté tel quel sur chaque offre. */
  employer: string;
}

/**
 * Premier label de l'hôte, utilisé comme identifiant de locataire : "grandprix".
 *
 * Les identifiants d'offre sont portés par le locataire, pas par le portail :
 * la même réquisition apparaît sous le même `job/view/<id>` sur plusieurs
 * portails du même employeur. Préfixer par le locataire — et non par le site —
 * fait que l'offre 89 vue sur HeadOffice et sur Events produit un seul
 * identifiant, donc une seule alerte.
 */
function tenantOf(cfg: ElmoConfig): string {
  return cfg.host.split(".")[0];
}

export function elmoSourceId(cfg: ElmoConfig): string {
  return `elmo:${tenantOf(cfg)}:${cfg.site}`;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'",
};

/** Texte visible d'un fragment HTML : balises retirées, entités décodées. */
function text(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name: string) => {
      const key = name.toLowerCase();
      if (ENTITIES[key] !== undefined) return ENTITIES[key];
      if (key.startsWith("#x")) return String.fromCodePoint(parseInt(key.slice(2), 16));
      if (key.startsWith("#")) return String.fromCodePoint(parseInt(key.slice(1), 10));
      return whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Valeur de la colonne repérée par son icône.
 *
 * Chaque ligne d'offre associe une glyphicon Bootstrap à une donnée :
 * map-marker au lieu, pencil au type de contrat, calendar à la date de clôture.
 */
function fieldAfter(block: string, glyph: string): string | undefined {
  const marker = block.indexOf(`glyphicon-${glyph}`);
  if (marker === -1) return undefined;
  const cell = /<div class="col-md-10[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block.slice(marker));
  const value = cell ? text(cell[1]) : "";
  return value || undefined;
}

/** Compteur « 1 - 20 of 37 jobs shown » affiché sous la liste. */
function pagination(html: string): { from: number; to: number; total: number } | undefined {
  const m = /(\d+)\s*-\s*(\d+)\s+of\s+(\d+)\s+jobs?/i.exec(html);
  if (!m) return undefined;
  return { from: Number(m[1]), to: Number(m[2]), total: Number(m[3]) };
}

export function parseElmoJobs(cfg: ElmoConfig, html: string): JobPosting[] {
  // Marqueur de structure : le conteneur de la liste d'offres. Son absence
  // signifie que la page a changé de forme, jamais qu'il n'y a aucune offre.
  if (!html.includes('id="section-list"')) {
    throw new Error(
      `Page ELMO inattendue pour ${cfg.site} : conteneur "section-list" absent`
    );
  }

  const tenant = tenantOf(cfg);
  const jobs: JobPosting[] = [];
  const blocks = html.split(/<li class="list-group-item"/).slice(1);

  for (const block of blocks) {
    const link = /href="(\/careers\/[^"]*\/job\/view\/(\d+))"/.exec(block);
    if (!link) continue; // ligne sans lien exploitable : ni URL ni identifiant fiables

    const anchor = /<a\b[^>]*job\/view\/\d+[^>]*>([\s\S]*?)<\/a>/.exec(block);
    jobs.push({
      id: `elmo:${tenant}:${link[2]}`,
      source: elmoSourceId(cfg),
      employer: cfg.employer,
      title: (anchor ? text(anchor[1]) : "") || "Sans titre",
      location: fieldAfter(block, "map-marker") || "",
      url: `https://${cfg.host}${link[1]}`,
      timeType: fieldAfter(block, "pencil"),
      closesOn: fieldAfter(block, "calendar"),
    });
  }

  const counts = pagination(html);
  if (!counts && jobs.length === 0) {
    throw new Error(
      `Page ELMO inattendue pour ${cfg.site} : ni offre ni compteur de pagination`
    );
  }
  if (counts) {
    const shown = counts.total === 0 ? 0 : counts.to - counts.from + 1;
    if (jobs.length !== shown) {
      throw new Error(
        `Extraction ELMO incohérente pour ${cfg.site} : ${jobs.length} offre(s) lue(s) ` +
          `pour ${shown} annoncée(s) — la mise en page a changé`
      );
    }
    // La pagination ELMO n'a jamais pu être observée : les portails AGPC
    // tiennent sur une page. Échouer bruyamment plutôt que perdre des offres
    // en silence le jour où ce ne sera plus vrai.
    if (counts.total > counts.to) {
      throw new Error(
        `${cfg.site} annonce ${counts.total} offres mais n'en expose que ${counts.to} ` +
          `sur cette page — pagination ELMO à implémenter`
      );
    }
  }

  return jobs;
}

/** Récupère la page carrières et retourne les offres normalisées. Lève en cas d'échec. */
export async function fetchElmoJobs(cfg: ElmoConfig): Promise<JobPosting[]> {
  const url = `https://${cfg.host}/careers/${cfg.site}/jobs`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        // ELMO répond 403 aux clients sans agent utilisateur reconnaissable.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ELMO ${cfg.site} a répondu ${res.status}`);
    return parseElmoJobs(cfg, await res.text());
  } finally {
    clearTimeout(timer);
  }
}
