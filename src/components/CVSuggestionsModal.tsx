"use client";

import { useEffect, useState } from "react";
import type { ScoredJob } from "@/lib/scrapers/types";
import type { CVSuggestion } from "@/lib/ai/cv-suggestions";
import Modal from "./Modal";
import { Check, X } from "./Icons";

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-rose-400/10 border-rose-300/25 text-rose-200",
  medium: "bg-amber-400/10 border-amber-300/25 text-amber-200",
  low: "bg-sky-400/10 border-sky-300/25 text-sky-200",
};

export default function CVSuggestionsModal({ job, onClose }: { job: ScoredJob; onClose: () => void }) {
  const [items, setItems] = useState<CVSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<Record<number, "accepted" | "rejected">>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cv-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setItems(data.suggestions);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [job.id]);

  return (
    <Modal title="CV suggestions" subtitle={`Tailored for ${job.title} · ${job.company}`} onClose={onClose} maxWidth="max-w-3xl">
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass rounded-2xl p-4 space-y-2">
              <div className="skeleton h-4 w-1/3 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-5/6 rounded" />
            </div>
          ))}
          <p className="text-sm text-white/40">Analysing your CV against this role…</p>
        </div>
      ) : error ? (
        <div className="text-rose-200/90 bg-rose-500/10 border border-rose-300/20 rounded-xl p-4 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <p className="text-white/60 text-sm">No suggestions returned — your CV already fits this role well.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-white/50">
            Review each suggestion and accept the ones you want to apply to your CV.
          </p>
          {items.map((s, i) => {
            const d = decision[i];
            return (
              <div
                key={i}
                className={`glass rounded-2xl p-4 transition-opacity ${d === "rejected" ? "opacity-40" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white/90">{s.section}</span>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[s.priority] || PRIORITY_STYLE.low}`}>
                      {s.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setDecision((p) => ({ ...p, [i]: "accepted" }))}
                      className={`cursor-pointer w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                        d === "accepted"
                          ? "bg-emerald-500/30 border-emerald-300/40 text-emerald-100"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                      }`}
                      aria-label="Accept suggestion"
                    >
                      <Check width={16} height={16} />
                    </button>
                    <button
                      onClick={() => setDecision((p) => ({ ...p, [i]: "rejected" }))}
                      className={`cursor-pointer w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                        d === "rejected"
                          ? "bg-rose-500/30 border-rose-300/40 text-rose-100"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                      }`}
                      aria-label="Reject suggestion"
                    >
                      <X width={16} height={16} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-white/65 mt-2 leading-relaxed">{s.suggestion}</p>
                <div className="mt-3 rounded-xl bg-black/30 border border-white/10 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-cyan-300/70 mb-1">Paste-ready example</p>
                  <p className="text-sm text-white/85 leading-relaxed">{s.example}</p>
                </div>
              </div>
            );
          })}
          <div className="text-sm text-white/50 pt-1">
            {Object.values(decision).filter((d) => d === "accepted").length} accepted ·{" "}
            {Object.values(decision).filter((d) => d === "rejected").length} dismissed
          </div>
        </div>
      )}
    </Modal>
  );
}
