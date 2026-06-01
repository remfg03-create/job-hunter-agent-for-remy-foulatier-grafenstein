/** Circular 1–10 compatibility score with a color scale from red → emerald. */

export function scoreColor(score: number): { ring: string; text: string; glow: string; label: string } {
  if (score >= 9) return { ring: "#34d399", text: "#34d399", glow: "rgba(52,211,153,0.45)", label: "Excellent fit" };
  if (score >= 7) return { ring: "#a3e635", text: "#a3e635", glow: "rgba(163,230,53,0.40)", label: "Strong fit" };
  if (score >= 5) return { ring: "#fbbf24", text: "#fbbf24", glow: "rgba(251,191,36,0.40)", label: "Partial fit" };
  if (score >= 3) return { ring: "#fb923c", text: "#fb923c", glow: "rgba(251,146,60,0.40)", label: "Weak fit" };
  return { ring: "#f87171", text: "#f87171", glow: "rgba(248,113,113,0.40)", label: "Not a fit" };
}

export default function ScoreBadge({ score, size = 60 }: { score: number; size?: number }) {
  const c = scoreColor(score);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 10));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${score}/10 — ${c.label}`}>
      <svg width={size} height={size} className="-rotate-90" style={{ filter: `drop-shadow(0 0 8px ${c.glow})` }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.10)" strokeWidth={4} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.ring}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold leading-none" style={{ color: c.text, fontSize: size * 0.34 }}>
          {score}
        </span>
        <span className="text-[9px] text-white/40 leading-none mt-0.5">/10</span>
      </div>
    </div>
  );
}
