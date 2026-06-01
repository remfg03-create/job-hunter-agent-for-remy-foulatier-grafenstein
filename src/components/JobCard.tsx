"use client";

import type { ScoredJob } from "@/lib/scrapers/types";
import { JOB_SITES } from "@/lib/config";
import ScoreBadge from "./ScoreBadge";
import { Building, MapPin, ExternalLink, FileText, Sparkles, Mail, Check } from "./Icons";

const SOURCE_NAME: Record<string, string> = Object.fromEntries(JOB_SITES.map((s) => [s.id, s.name]));

const CONTRACT_LABEL: Record<string, string> = {
  "fixed-term": "Fixed-term / CDD",
  permanent: "Permanent",
  internship: "Internship",
  freelance: "Freelance",
};

export default function JobCard({
  job,
  applied,
  onCoverLetter,
  onSuggestions,
  onApply,
}: {
  job: ScoredJob;
  applied: boolean;
  onCoverLetter: (job: ScoredJob) => void;
  onSuggestions: (job: ScoredJob) => void;
  onApply: (job: ScoredJob) => void;
}) {
  return (
    <article className="glass glass-hover fadeup rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <ScoreBadge score={job.score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-cyan-300/80 font-medium">
              {SOURCE_NAME[job.source] || job.source}
            </span>
            {job.contractType && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                {CONTRACT_LABEL[job.contractType] || job.contractType}
              </span>
            )}
            {job.isSample && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-300/20 text-amber-200/80">
                sample
              </span>
            )}
            {applied && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-300/25 text-emerald-200">
                <Check width={11} height={11} /> draft made
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold mt-1 leading-snug truncate">{job.title}</h3>
          <div className="flex items-center gap-4 mt-1 text-sm text-white/55">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Building width={14} height={14} className="shrink-0" />
              <span className="truncate">{job.company}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <MapPin width={14} height={14} /> {job.location}
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm text-white/55 leading-relaxed line-clamp-2">{job.reasoning}</p>

      <div className="flex flex-wrap gap-1.5">
        {job.matchingSkills.slice(0, 6).map((s) => (
          <span key={s} className="text-[11px] px-2 py-1 rounded-lg bg-emerald-400/10 border border-emerald-300/20 text-emerald-200/90">
            {s}
          </span>
        ))}
        {job.missingSkills.slice(0, 3).map((s) => (
          <span key={s} className="text-[11px] px-2 py-1 rounded-lg bg-rose-400/10 border border-rose-300/20 text-rose-200/80 line-through decoration-rose-300/40">
            {s}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={() => onCoverLetter(job)}
          className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-300/25 text-cyan-100 hover:from-cyan-500/30 hover:to-indigo-500/30 transition-colors"
        >
          <Sparkles width={15} height={15} /> Cover letter
        </button>
        <button
          onClick={() => onSuggestions(job)}
          className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors"
        >
          <FileText width={15} height={15} /> CV tips
        </button>
        <button
          onClick={() => onApply(job)}
          title="Prepare a Gmail draft"
          className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors"
        >
          <Mail width={15} height={15} /> Apply
        </button>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open the original posting"
          className="cursor-pointer ml-auto inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ExternalLink width={16} height={16} />
        </a>
      </div>
    </article>
  );
}
