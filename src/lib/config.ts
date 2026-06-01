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
  "Your autonomous AI recruiter — scans 5 job boards 4× a day, scores every match against your CV, and drafts the application.";

export type ContractType = "fixed-term" | "permanent" | "internship" | "freelance";

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
 * Default criteria for Rémy: sales / events / marketing in the hospitality &
 * lifestyle space (think "We Are Ona"), based in Berlin or Paris, open to both
 * fixed-term and permanent contracts.
 */
export const DEFAULT_CRITERIA: SearchCriteria = {
  roles: [
    "Sales",
    "Business Development",
    "Event Manager",
    "Event Coordinator",
    "Marketing Manager",
    "Brand Partnerships",
    "Account Manager",
  ],
  locations: ["Berlin", "Paris"],
  contractTypes: ["fixed-term", "permanent"],
  keywords: [
    "hospitality",
    "events",
    "lifestyle",
    "food & beverage",
    "experiential",
    "creative agency",
    "luxury",
    "community",
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
