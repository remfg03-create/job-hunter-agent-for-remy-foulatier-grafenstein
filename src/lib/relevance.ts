/**
 * Filtrage d'une offre avant alerte.
 *
 * Deux filtres seulement, volontairement grossiers : le lieu et les familles de
 * métiers manifestement hors profil. Le scoring fin contre le CV reste le
 * travail de src/lib/ai/score.ts, qui exige une clé Anthropic.
 *
 * Principe directeur : n'écarter que ce qui est clairement hors cible. Tout
 * titre non reconnu est conservé — mieux vaut une offre de trop qu'une offre
 * perdue. Les offres écartées sont comptées et rapportées, jamais supprimées
 * en silence.
 */

import type { JobPosting } from "@/lib/sources/types";

/**
 * Lieux valant « Melbourne ».
 *
 * On ne teste pas « VIC » seul : cela ferait entrer Geelong ou Phillip Island,
 * hors du périmètre arrêté avec Rémy le 2026-09-12 (Melbourne uniquement).
 */
export const MELBOURNE = [
  "melbourne",
  "albert park",
  "st kilda",
  "melbourne park",
  "rod laver",
  "aami park",
  "olympic park",
  "docklands",
  "mcg",
  "flemington",
];

/**
 * Familles de métiers hors profil : technique, juridique, finance, santé,
 * design produit. Rémy vise l'événementiel sportif et l'hospitality.
 */
export const OFF_PROFILE_EVENTS = [
  "architect",
  "developer",
  "software",
  "engineer",
  "cyber",
  "data scientist",
  // Ajouté le 2026-09-14 : « Head of Data, Analytics and Insights » était passé
  // à travers le filtre lors du premier passage sur GitHub Actions.
  "data",
  "analytics",
  "insights",
  "business intelligence",
  "paralegal",
  "lawyer",
  "legal counsel",
  "accountant",
  "payroll",
  "financial controller",
  "physiotherapist",
  "nurse",
  "doctor",
  "experience designer",
  "compliance",
  "actuar",
  // Rémy fait de la salle et du bar, pas de la cuisine : ces postes exigent
  // une qualification culinaire qu'il n'a pas.
  "chef",
  "cook",
];

/**
 * Postes trop seniors pour un profil qui sort d'études. « Lead » et « Manager »
 * sont volontairement absents : l'Events Lead des Saints, auquel Rémy candidate,
 * serait passé à la trappe.
 */
export const TOO_SENIOR = [
  "head of",
  "director",
  "chief",
  "general manager",
  "vice president",
];

export type Rejection = "hors-zone" | "hors-profil" | "trop-senior" | "hors-domaine";

export interface ScreenResult {
  kept: JobPosting[];
  /** Offres écartées, avec le motif — affichées dans le rapport de passage. */
  rejected: { posting: JobPosting; reason: Rejection }[];
}

function matchesAny(haystack: string, needles: string[]): boolean {
  const s = haystack.toLowerCase();
  return needles.some((n) => s.includes(n));
}

export function isInMelbourne(location: string): boolean {
  return matchesAny(location, MELBOURNE);
}

export interface Screening {
  /** Familles de métiers hors du profil de la personne. */
  offProfile: string[];
  /** Intitulés trop seniors pour elle. */
  tooSenior: string[];
  /**
   * Filtre inversé : si défini, l'intitulé doit contenir au moins un de ces
   * termes. Nécessaire quand la requête source est trop large pour être
   * corrigée par une liste d'exclusions — chercher « intern » remonte les
   * stages de tous les métiers, et blacklister radiographie, orthophonie,
   * design et réfrigération un par un est sans fin. Exiger le domaine est plus
   * court et plus sûr.
   */
  requireAny?: string[];
}

export function isOffProfile(title: string, list: string[] = OFF_PROFILE_EVENTS): boolean {
  return matchesAny(title, list);
}

export function isTooSenior(title: string, list: string[] = TOO_SENIOR): boolean {
  return matchesAny(title, list);
}

/**
 * Trie les offres d'une cible.
 *
 * `assumeMelbourne` s'applique aux employeurs dont tous les postes sont à
 * Melbourne mais qui n'écrivent pas la ville dans le champ lieu — l'AGPC
 * affiche « Australian Grand Prix Corporation Head Office ». Sans cette
 * exception, le filtre géographique écarterait le poste le plus important.
 */
export function screen(
  postings: JobPosting[],
  opts: { assumeMelbourne: boolean; screening?: Screening }
): ScreenResult {
  const off = opts.screening?.offProfile ?? OFF_PROFILE_EVENTS;
  const senior = opts.screening?.tooSenior ?? TOO_SENIOR;
  const require = opts.screening?.requireAny;
  const kept: JobPosting[] = [];
  const rejected: { posting: JobPosting; reason: Rejection }[] = [];

  for (const p of postings) {
    if (isOffProfile(p.title, off)) {
      rejected.push({ posting: p, reason: "hors-profil" });
      continue;
    }
    if (isTooSenior(p.title, senior)) {
      rejected.push({ posting: p, reason: "trop-senior" });
      continue;
    }
    if (require && !matchesAny(p.title, require)) {
      rejected.push({ posting: p, reason: "hors-domaine" });
      continue;
    }
    if (!opts.assumeMelbourne && !isInMelbourne(p.location)) {
      rejected.push({ posting: p, reason: "hors-zone" });
      continue;
    }
    kept.push(p);
  }

  return { kept, rejected };
}
