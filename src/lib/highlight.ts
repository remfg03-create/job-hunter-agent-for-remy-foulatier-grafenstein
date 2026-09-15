/**
 * Mise en avant des offres dans l'alerte.
 *
 * Matthieu cherche un stage rémunéré démarrant début janvier. Aucune des deux
 * informations n'est exposée proprement par la source :
 *
 * - le champ salaire d'Adzuna est vide sur la quasi-totalité des stages,
 *   constaté le 2026-09-15 sur un échantillon de dix annonces ;
 * - la date de début figure rarement dans le résumé de 500 caractères.
 *
 * On ne déduit donc jamais qu'une offre est rémunérée : on distingue ce qui est
 * explicitement non rémunéré, ce qui est explicitement rémunéré, et ce qui n'en
 * dit rien. Annoncer « rémunéré » sans preuve serait pire que de se taire.
 */

import type { JobPosting } from "@/lib/sources/types";

export type PayStatus = "remunere" | "non-remunere" | "non-precise";

export interface Highlights {
  pay: PayStatus;
  /** Le texte mentionne le mois recherché. */
  matchesMonth: boolean;
  /** L'employeur figure parmi les grands groupes suivis pour ce profil. */
  majorEmployer: boolean;
}

export interface HighlightOptions {
  /** Mois de démarrage recherché, en anglais : "january". */
  month?: string;
  /**
   * Grands employeurs mis en avant. Liste tenue à la main : il n'existe pas de
   * source fiable et gratuite de la taille des entreprises, et deviner à partir
   * du nombre d'annonces donnerait surtout des cabinets de recrutement.
   */
  majorEmployers?: string[];
}

/** « paid » est contenu dans « unpaid » : on teste la négation d'abord. */
const UNPAID = /\bunpaid\b|\bvoluntary\b|\bvolunteer\b|\bno remuneration\b|\bnon[- ]paid\b/i;
const PAID = /\bpaid\b|\bsalary\b|\bsalaried\b|\bhourly rate\b|\bstipend\b|\bremunerat/i;

export function highlight(p: JobPosting, opts: HighlightOptions = {}): Highlights {
  const text = `${p.title} ${p.description ?? ""}`;
  const employer = p.employer.toLowerCase();
  const pay: PayStatus = UNPAID.test(text)
    ? "non-remunere"
    : PAID.test(text)
      ? "remunere"
      : "non-precise";
  const matchesMonth = opts.month
    ? new RegExp(`\\b${opts.month}\\b`, "i").test(text)
    : false;
  const majorEmployer = (opts.majorEmployers ?? []).some((m) =>
    employer.includes(m.toLowerCase())
  );
  return { pay, matchesMonth, majorEmployer };
}

/**
 * Ordre d'affichage : ce qui coche les deux critères en tête, ce qui est
 * explicitement non rémunéré en queue. L'ordre d'origine départage le reste.
 */
export function rank(postings: JobPosting[], opts: HighlightOptions = {}): JobPosting[] {
  const weight = (p: JobPosting): number => {
    const h = highlight(p, opts);
    let w = 0;
    if (h.matchesMonth) w -= 4;
    if (h.majorEmployer) w -= 3;
    if (h.pay === "remunere") w -= 2;
    if (h.pay === "non-remunere") w += 3;
    return w;
  };
  return [...postings]
    .map((p, i) => ({ p, i, w: weight(p) }))
    .sort((a, b) => a.w - b.w || a.i - b.i)
    .map((x) => x.p);
}
