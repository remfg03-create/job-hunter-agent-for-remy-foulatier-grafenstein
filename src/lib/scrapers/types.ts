import type { ContractType } from "@/lib/config";

/** A raw job posting as returned by a scraper (before AI scoring). */
export interface RawJob {
  /** Stable id, unique across sources (e.g. "wttj-abc123"). */
  id: string;
  title: string;
  company: string;
  location: string;
  /** Which job board it came from (JobSite.id). */
  source: string;
  /** Direct link to the posting. */
  url: string;
  /** Full or truncated description used for scoring + cover letters. */
  description: string;
  contractType?: ContractType;
  /** ISO date string when the posting was published, if known. */
  postedAt?: string;
  /** Salary text if the posting exposes it. */
  salary?: string;
  /** True when this entry came from the bundled sample fallback, not a live fetch. */
  isSample?: boolean;
}

/** A job after the AI evaluator has graded it against the CV. */
export interface ScoredJob extends RawJob {
  /** 1–10 compatibility score with the CV. */
  score: number;
  /** Skills from the CV that match this job. */
  matchingSkills: string[];
  /** Skills the job wants that are missing / weak in the CV. */
  missingSkills: string[];
  /** One-paragraph rationale for the score. */
  reasoning: string;
  /** ISO timestamp when scored. */
  scoredAt: string;
}

/** Signature every site scraper implements. */
export type ScraperFn = (criteria: import("@/lib/config").SearchCriteria) => Promise<RawJob[]>;
