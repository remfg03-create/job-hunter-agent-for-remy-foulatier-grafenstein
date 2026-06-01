"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchCriteria } from "@/lib/config";
import Modal from "./Modal";
import { Upload, Check, FileText } from "./Icons";

interface CVInfo {
  filename: string;
  wordCount: number;
  preview?: string;
}

export default function SettingsPanel({
  onClose,
  cv,
  onCVUpdated,
}: {
  onClose: () => void;
  cv: CVInfo | null;
  onCVUpdated: () => void;
}) {
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/criteria")
      .then((r) => r.json())
      .then(setCriteria);
  }, []);

  function setField(key: keyof SearchCriteria, value: string) {
    setCriteria((c) => (c ? { ...c, [key]: value.split(",").map((s) => s.trim()).filter(Boolean) } : c));
    setSaved(false);
  }

  async function save() {
    if (!criteria) return;
    setSaving(true);
    await fetch("/api/criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(criteria),
    });
    setSaving(false);
    setSaved(true);
  }

  async function upload(file: File) {
    setUploading(true);
    setUploadMsg("");
    setUploadErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/cv", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setUploadMsg(`Parsed ${data.filename} — ${data.wordCount} words (${data.format}).`);
      onCVUpdated();
    } catch (e) {
      setUploadErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal title="Settings" subtitle="Your CV and search criteria" onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-8">
        {/* CV upload */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-300/80 mb-3">Your CV</h3>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) upload(f);
            }}
            className="cursor-pointer glass-hover rounded-2xl border border-dashed border-white/15 p-6 flex flex-col items-center justify-center text-center gap-2"
          >
            <Upload className="text-cyan-300/80" width={26} height={26} />
            <p className="text-sm text-white/70">
              {uploading ? "Parsing…" : "Drop a PDF / Word / .txt CV here, or click to browse"}
            </p>
            {cv && (
              <p className="text-xs text-white/45 inline-flex items-center gap-1.5">
                <FileText width={13} height={13} /> Current: {cv.filename} · {cv.wordCount} words
              </p>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          {uploadMsg && (
            <p className="text-emerald-200 text-sm mt-2 inline-flex items-center gap-1.5">
              <Check width={15} height={15} /> {uploadMsg}
            </p>
          )}
          {uploadErr && <p className="text-rose-200/90 text-sm mt-2">{uploadErr}</p>}
        </section>

        {/* Criteria */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-300/80 mb-3">Search criteria</h3>
          {!criteria ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-10 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Roles" value={criteria.roles} onChange={(v) => setField("roles", v)} />
              <Field label="Locations" value={criteria.locations} onChange={(v) => setField("locations", v)} />
              <Field label="Contract types" value={criteria.contractTypes} onChange={(v) => setField("contractTypes", v)} />
              <Field label="Keywords" value={criteria.keywords} onChange={(v) => setField("keywords", v)} />
              <Field label="Languages" value={criteria.languages} onChange={(v) => setField("languages", v)} />
              <p className="text-xs text-white/40">Comma-separated. Saved criteria drive the next scan.</p>
              <button
                onClick={save}
                disabled={saving}
                className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500/25 to-indigo-500/25 border border-cyan-300/25 text-cyan-50 hover:from-cyan-500/35 hover:to-indigo-500/35 transition-colors disabled:opacity-50"
              >
                {saved ? <Check width={15} height={15} /> : null}
                {saving ? "Saving…" : saved ? "Saved" : "Save criteria"}
              </button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

function Field({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-white/50">{label}</span>
      <input
        defaultValue={value.join(", ")}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-300/40"
      />
    </label>
  );
}
