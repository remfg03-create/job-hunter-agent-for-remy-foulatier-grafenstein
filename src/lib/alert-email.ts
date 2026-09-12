/**
 * Rendu de l'alerte mail du veilleur.
 *
 * Fonction pure : aucun appel réseau, donc entièrement testable. L'envoi est
 * assuré par l'appelant via src/lib/gmail.ts.
 */

import type { JobPosting } from "@/lib/sources/types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAlert(
  postings: JobPosting[],
  brokenSources: string[]
): { subject: string; html: string } | null {
  if (postings.length === 0 && brokenSources.length === 0) return null;

  const employers = [...new Set(postings.map((p) => p.employer))];
  const plural = postings.length > 1 ? "s" : "";
  const subject =
    postings.length > 0
      ? `${postings.length} nouvelle${plural} offre${plural} — ${employers.join(", ")}`
      : `Veilleur : ${brokenSources.length} source${
          brokenSources.length > 1 ? "s" : ""
        } en échec`;

  const rows = postings
    .map(
      (p) => `<li style="margin-bottom:10px">
  <a href="${escapeHtml(p.url)}"><strong>${escapeHtml(p.title)}</strong></a><br>
  <span style="color:#555">${escapeHtml(p.employer)} · ${escapeHtml(p.location)}${
        p.timeType ? ` · ${escapeHtml(p.timeType)}` : ""
      }${p.postedOn ? ` · ${escapeHtml(p.postedOn)}` : ""}</span>${
        p.closesOn
          ? `<br><span style="color:#b00">Clôture : ${escapeHtml(p.closesOn)}</span>`
          : ""
      }
</li>`
    )
    .join("\n");

  const broken =
    brokenSources.length > 0
      ? `<h3>Sources en échec</h3><ul>${brokenSources
          .map((s) => `<li>${escapeHtml(s)}</li>`)
          .join("")}</ul>`
      : "";

  const list = postings.length > 0 ? `<h3>Nouvelles offres</h3><ul>${rows}</ul>` : "";

  return {
    subject,
    html: `<div style="font-family:system-ui,sans-serif;font-size:14px">${list}${broken}</div>`,
  };
}
