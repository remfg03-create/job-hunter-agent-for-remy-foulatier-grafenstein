/**
 * Central configuration for the Job Hunter Agent.
 *
 * Branding, the default search criteria, and the list of job sites all live here.
 * The dashboard Settings panel reads/writes the criteria at runtime (persisted via
 * the store), but these defaults are the source of truth on a fresh install.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_USER_NAME || "Rémy Foulatier Gräfenstein";
export const APP_TITLE = `Job Hunter Agent for ${APP_NAME}`;
export const APP_TAGLINE =
  "Veilleur emploi Melbourne — surveille les employeurs de l'événementiel sportif " +
  "4 fois par jour, alerte à l'ouverture des campagnes, score chaque offre contre le CV.";

/**
 * Types de contrat. "casual" et "seasonal" sont les formes dominantes de
 * l'événementiel australien, et les plus accessibles sous WHV 417.
 */
export type ContractType =
  | "casual"
  | "seasonal"
  | "fixed-term"
  | "permanent"
  | "internship"
  | "freelance";

export interface SearchCriteria {
  /** Job titles / role families to target. */
  roles: string[];
  /** Cities the agent searches in. */
  locations: string[];
  /** Contract types of interest. */
  contractTypes: ContractType[];
  /** Free-text keywords that sharpen the match (industry, vibe, tools). */
  keywords: string[];
  /** Languages the postings may be written in. */
  languages: string[];
}

/**
 * Critères de Rémy — cible Melbourne, arbitrés avec lui le 2026-09-12.
 *
 * Deux familles retenues, dans cet ordre de priorité :
 *   1. événementiel sportif — Grand Prix, Australian Open, MCG, Melbourne Cup ;
 *   2. hospitality et gastronomie — plus gros volume, plus accessible en WHV.
 *
 * Communication/médias et marketing ont été écartés du périmètre de la veille
 * (il candidate à un poste de communication à l'AGPC, mais ne veut pas que la
 * veille remonte cette famille de postes).
 *
 * Contexte statutaire : Working Holiday Visa 417 visé, donc les postes exigeant
 * la résidence permanente, la citoyenneté ou un sponsor sont hors cible.
 */
export const DEFAULT_CRITERIA: SearchCriteria = {
  roles: [
    "Event Operations",
    "Event Coordinator",
    "Event Crew",
    "Guest Experience",
    "Customer Service",
    "Hospitality Attendant",
    "Food and Beverage Attendant",
    "Bartender",
    "Waiter",
  ],
  locations: ["Melbourne"],
  contractTypes: ["casual", "seasonal", "fixed-term"],
  keywords: [
    "motorsport",
    "Formula 1",
    "Grand Prix",
    "tennis",
    "stadium",
    "venue",
    "festival",
    "match day",
    "race day",
    "hospitality",
    "food & beverage",
    "working holiday",
  ],
  languages: ["English", "French", "German"],
};

export interface JobSite {
  id: string;
  name: string;
  /** Public website, shown in the UI. */
  url: string;
}

/** The 5 job boards the agent sweeps each run. */
export const JOB_SITES: JobSite[] = [
  { id: "welcome-to-the-jungle", name: "Welcome to the Jungle", url: "https://www.welcometothejungle.com" },
  { id: "apec", name: "APEC", url: "https://www.apec.fr" },
  { id: "indeed", name: "Indeed", url: "https://www.indeed.com" },
  { id: "linkedin", name: "LinkedIn", url: "https://www.linkedin.com/jobs" },
  { id: "hellowork", name: "HelloWork", url: "https://www.hellowork.com" },
];

/** AI model selection — overridable via env so cost/quality can be tuned. */
export const MODELS = {
  /** Cheap + fast: used to score many jobs per run. */
  scoring: process.env.ANTHROPIC_SCORING_MODEL || "claude-sonnet-4-6",
  /** Higher quality: used for cover letters and CV suggestions. */
  writing: process.env.ANTHROPIC_WRITING_MODEL || "claude-opus-4-8",
};

/** How many jobs (max) to keep per scan, sorted by score. */
export const MAX_JOBS_PER_SCAN = 40;
