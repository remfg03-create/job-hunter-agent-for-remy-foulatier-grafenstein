"use client";

import { useEffect, useState } from "react";
import type { ScoredJob } from "@/lib/scrapers/types";
import Modal from "./Modal";
import { Sparkles, Mail, Check } from "./Icons";

export default function CoverLetterModal({
  job,
  onClose,
  onApplied,
}: {
  job: ScoredJob;
  onClose: () => void;
  onApplied: (jobId: string) => void;
}) {
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [to, setTo] = useState("");
  const [applying, setApplying] = useState(false);
  const [draftMsg, setDraftMsg] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setLetter(data.letter);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createDraft() {
    setApplying(true);
    setDraftMsg("");
    setError("");
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, coverLetter: letter, to }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setDraftMsg("Draft created in Gmail — review and send it from your Drafts folder.");
      onApplied(job.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal title="Cover letter" subtitle={`${job.title} · ${job.company}`} onClose={onClose}>
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-4 rounded" style={{ width: `${70 + ((i * 7) % 30)}%` }} />
          ))}
          <p className="text-sm text-white/40 pt-2">Writing a tailored letter with Claude…</p>
        </div>
      ) : error && !letter ? (
        <div className="text-rose-200/90 bg-rose-500/10 border border-rose-300/20 rounded-xl p-4 text-sm">
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          <textarea
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            className="w-full h-72 rounded-xl bg-black/30 border border-white/10 p-4 text-sm leading-relaxed text-white/90 focus:outline-none focus:border-cyan-300/40 resize-y scroll-thin"
            aria-label="Editable cover letter"
          />
          <p className="text-xs text-white/40">You can edit the letter above before creating the Gmail draft.</p>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Recipient email (optional — leave blank to fill in Gmail)"
              className="flex-1 rounded-xl bg-black/30 border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-300/40"
              aria-label="Recipient email"
            />
          </div>

          {error && letter && (
            <div className="text-rose-200/90 bg-rose-500/10 border border-rose-300/20 rounded-xl p-3 text-sm">{error}</div>
          )}
          {draftMsg && (
            <div className="text-emerald-200 bg-emerald-500/10 border border-emerald-300/20 rounded-xl p-3 text-sm inline-flex items-center gap-2">
              <Check width={16} height={16} /> {draftMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={generate}
              className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <Sparkles width={15} height={15} /> Regenerate
            </button>
            <button
              onClick={createDraft}
              disabled={applying || !letter}
              className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 border border-emerald-300/30 text-emerald-50 hover:from-emerald-500/40 hover:to-cyan-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mail width={15} height={15} /> {applying ? "Creating draft…" : "Create Gmail draft"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
