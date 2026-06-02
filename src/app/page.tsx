"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScoredJob } from "@/lib/scrapers/types";
import { APP_NAME, JOB_SITES } from "@/lib/config";
import JobCard from "@/components/JobCard";
import CoverLetterModal from "@/components/CoverLetterModal";
import CVSuggestionsModal from "@/components/CVSuggestionsModal";
import SettingsPanel from "@/components/SettingsPanel";
import { Refresh, Settings, Sparkles, Briefcase, Target, Clock, Zap, Search } from "@/components/Icons";

interface JobsResponse {
  jobs: ScoredJob[];
  applied: string[];
  lastScan: string | null;
  cv: { filename: string; updatedAt: string; wordCount: number } | null;
  aiEnabled: boolean;
  storeBackend: string;
}

export default function Dashboard() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [source, setSource] = useState("all");

  const [coverJob, setCoverJob] = useState<ScoredJob | null>(null);
  const [suggestJob, setSuggestJob] = useState<ScoredJob | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [cvText, setCvText] = useState<string | undefined>(undefined);

  // Persist results in the browser so a reload doesn't lose them (serverless
  // in-memory storage isn't shared across requests; add Vercel KV for server-side
  // durability — see README).
  const LS = "jha:dashboard:v1";

  const load = useCallback(async () => {
    // Seed instantly from localStorage, then refresh metadata from the server.
    try {
      const cached = typeof window !== "undefined" ? window.localStorage.getItem(LS) : null;
      if (cached) {
        const c = JSON.parse(cached) as Partial<JobsResponse> & { cvText?: string };
        setData((prev) => ({
          jobs: c.jobs ?? [],
          applied: c.applied ?? [],
          lastScan: c.lastScan ?? null,
          cv: c.cv ?? null,
          aiEnabled: prev?.aiEnabled ?? false,
          storeBackend: prev?.storeBackend ?? "memory",
        }));
        if (c.cvText) setCvText(c.cvText);
      }
    } catch {
      /* ignore bad cache */
    }
    const res = await fetch("/api/jobs");
    const server = (await res.json()) as JobsResponse;
    setData((prev) => ({
      // Prefer server jobs if it actually has them, else keep what we cached.
      jobs: server.jobs?.length ? server.jobs : prev?.jobs ?? [],
      applied: prev?.applied?.length ? prev.applied : server.applied ?? [],
      lastScan: server.lastScan ?? prev?.lastScan ?? null,
      cv: server.cv ?? prev?.cv ?? null,
      aiEnabled: server.aiEnabled,
      storeBackend: server.storeBackend,
    }));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mirror jobs/applied/cv to localStorage whenever they change.
  useEffect(() => {
    if (!data) return;
    try {
      window.localStorage.setItem(
        LS,
        JSON.stringify({ jobs: data.jobs, applied: data.applied, lastScan: data.lastScan, cv: data.cv, cvText })
      );
    } catch {
      /* storage full / unavailable */
    }
  }, [data, cvText]);

  async function runScan() {
    setScanning(true);
    setScanError("");
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const result = await res.json();
      if (!result.ok) throw new Error(result.error);
      setData((prev) => ({
        jobs: result.jobs,
        applied: prev?.applied ?? [],
        lastScan: result.scannedAt,
        cv: prev?.cv ?? null,
        aiEnabled: prev?.aiEnabled ?? false,
        storeBackend: prev?.storeBackend ?? "memory",
      }));
    } catch (e) {
      setScanError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  function markApplied(jobId: string) {
    setData((prev) =>
      prev ? { ...prev, applied: prev.applied.includes(jobId) ? prev.applied : [...prev.applied, jobId] } : prev
    );
  }

  const jobs = data?.jobs ?? [];
  const applied = new Set(data?.applied ?? []);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (j.score < minScore) return false;
      if (source !== "all" && j.source !== source) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!`${j.title} ${j.company} ${j.location} ${j.matchingSkills.join(" ")}`.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [jobs, minScore, source, query]);

  const stats = useMemo(() => {
    if (jobs.length === 0) return { count: 0, avg: 0, top: 0, strong: 0 };
    const avg = jobs.reduce((s, j) => s + j.score, 0) / jobs.length;
    return {
      count: jobs.length,
      avg: Math.round(avg * 10) / 10,
      top: Math.max(...jobs.map((j) => j.score)),
      strong: jobs.filter((j) => j.score >= 7).length,
    };
  }, [jobs]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <header className="glass rounded-3xl p-6 sm:p-7 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400/30 to-indigo-500/30 border border-white/15 flex items-center justify-center">
              <Briefcase className="text-cyan-200" width={26} height={26} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                Job Hunter Agent <span className="text-white/40 font-normal">for</span>{" "}
                <span className="bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                  {APP_NAME}
                </span>
              </h1>
              <p className="text-sm text-white/50 mt-1">
                Scans 5 job boards 4× a day · scores every match against your CV · drafts the application.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            <button
              onClick={() => setShowSettings(true)}
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors"
            >
              <Settings width={18} height={18} /> Settings
            </button>
            <button
              onClick={runScan}
              disabled={scanning}
              className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/30 to-indigo-500/30 border border-cyan-300/30 text-cyan-50 hover:from-cyan-500/40 hover:to-indigo-500/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-medium"
            >
              <Refresh width={18} height={18} className={scanning ? "spinner" : ""} />
              {scanning ? "Scanning…" : "Run scan"}
            </button>
          </div>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-2 mt-5 text-xs">
          <Chip
            tone={data?.aiEnabled ? "good" : "warn"}
            icon={<Sparkles width={13} height={13} />}
            label={data?.aiEnabled ? "AI scoring active" : "AI off — set ANTHROPIC_API_KEY (heuristic scoring)"}
          />
          <Chip
            tone="muted"
            icon={<Zap width={13} height={13} />}
            label={`Storage: ${data?.storeBackend === "vercel-kv" ? "Vercel KV" : "in-memory"}`}
          />
          <Chip
            tone="muted"
            icon={<Clock width={13} height={13} />}
            label={data?.lastScan ? `Last scan ${new Date(data.lastScan).toLocaleString()}` : "No scan yet"}
          />
          {data?.cv && <Chip tone="muted" icon={<Target width={13} height={13} />} label={`CV: ${data.cv.filename}`} />}
        </div>
        {scanError && (
          <p className="text-rose-200/90 bg-rose-500/10 border border-rose-300/20 rounded-xl p-3 text-sm mt-4">
            {scanError}
          </p>
        )}
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Jobs found" value={stats.count} accent="#22d3ee" />
        <Stat label="Strong matches (7+)" value={stats.strong} accent="#34d399" />
        <Stat label="Top score" value={stats.top ? `${stats.top}/10` : "—"} accent="#a3e635" />
        <Stat label="Average score" value={stats.avg ? `${stats.avg}/10` : "—"} accent="#818cf8" />
      </section>

      {/* Filters */}
      <section className="glass rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 md:items-center">
        <div className="relative flex-1">
          <Search width={17} height={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, company, location or skill…"
            className="w-full rounded-xl bg-black/30 border border-white/10 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-300/40"
            aria-label="Search jobs"
          />
        </div>
        <label className="flex items-center gap-3 text-sm text-white/60">
          Min score
          <input
            type="range"
            min={0}
            max={10}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="accent-cyan-400 cursor-pointer"
          />
          <span className="w-6 text-white/80 font-medium tabular-nums">{minScore}</span>
        </label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="cursor-pointer rounded-xl bg-black/30 border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-300/40"
          aria-label="Filter by source"
        >
          <option value="all">All sources</option>
          {JOB_SITES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </section>

      {/* Jobs */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 space-y-4">
              <div className="flex gap-4">
                <div className="skeleton w-[60px] h-[60px] rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-1/4 rounded" />
                  <div className="skeleton h-5 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-8 w-2/3 rounded" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState onScan={runScan} scanning={scanning} />
      ) : filtered.length === 0 ? (
        <p className="text-center text-white/50 py-16">No jobs match these filters.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              applied={applied.has(job.id)}
              onCoverLetter={setCoverJob}
              onSuggestions={setSuggestJob}
              onApply={setCoverJob}
            />
          ))}
        </div>
      )}

      <footer className="text-center text-xs text-white/30 mt-12 pb-6">
        Job Hunter Agent · drafts only, nothing is sent without your review · built for the Antigravity curriculum
      </footer>

      {coverJob && (
        <CoverLetterModal
          job={coverJob}
          cvText={cvText}
          onClose={() => setCoverJob(null)}
          onApplied={markApplied}
        />
      )}
      {suggestJob && <CVSuggestionsModal job={suggestJob} cvText={cvText} onClose={() => setSuggestJob(null)} />}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          cv={data?.cv ?? null}
          onCVUpdated={(text, filename) => {
            setCvText(text);
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    cv: { filename, updatedAt: new Date().toISOString(), wordCount: text.split(/\s+/).filter(Boolean).length },
                  }
                : prev
            );
          }}
        />
      )}
    </main>
  );
}

function Chip({ tone, icon, label }: { tone: "good" | "warn" | "muted"; icon: React.ReactNode; label: string }) {
  const styles = {
    good: "bg-emerald-400/10 border-emerald-300/25 text-emerald-200",
    warn: "bg-amber-400/10 border-amber-300/25 text-amber-200",
    muted: "bg-white/5 border-white/10 text-white/55",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${styles}`}>
      {icon}
      {label}
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="glass glass-hover rounded-2xl p-5">
      <div className="text-3xl font-bold font-display" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-sm text-white/50 mt-1">{label}</div>
    </div>
  );
}

function EmptyState({ onScan, scanning }: { onScan: () => void; scanning: boolean }) {
  return (
    <div className="glass rounded-3xl p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-indigo-500/20 border border-white/15 flex items-center justify-center mx-auto mb-5">
        <Briefcase className="text-cyan-200" width={30} height={30} />
      </div>
      <h2 className="text-xl font-semibold">No jobs yet</h2>
      <p className="text-white/50 mt-2 max-w-md mx-auto">
        Run your first scan to sweep all 5 job boards and score every match against your CV.
      </p>
      <button
        onClick={onScan}
        disabled={scanning}
        className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500/30 to-indigo-500/30 border border-cyan-300/30 text-cyan-50 hover:from-cyan-500/40 hover:to-indigo-500/40 transition-colors font-medium mt-6 disabled:opacity-60"
      >
        <Refresh width={18} height={18} className={scanning ? "spinner" : ""} />
        {scanning ? "Scanning…" : "Run first scan"}
      </button>
    </div>
  );
}
