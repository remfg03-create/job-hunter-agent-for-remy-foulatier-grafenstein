/**
 * Rendu de l'alerte mail du veilleur.
 *
 * Fonction pure : aucun appel réseau, donc entièrement testable. L'envoi est
 * assuré par l'appelant via src/lib/gmail.ts.
 */

import type { JobPosting } from "@/lib/sources/types";
import { highlight, rank, type HighlightOptions } from "@/lib/highlight";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderAlert(
  postings: JobPosting[],
  brokenSources: string[],
  opts: HighlightOptions = {}
): { subject: string; html: string } | null {
  if (postings.length === 0 && brokenSources.length === 0) return null;

  // Objet volontairement nu : la liste des employeurs le rendait illisible dès
  // qu'il y avait plus de trois offres. Les noms sont dans le corps du message.
  const plural = postings.length > 1 ? "s" : "";
  const subject =
    postings.length > 0
      ? `${postings.length} nouvelle${plural} offre${plural}`
      : `Veilleur : ${brokenSources.length} source${
          brokenSources.length > 1 ? "s" : ""
        } en échec`;

  const chip = (text: string, bg: string, fg: string) =>
    `<span style="display:inline-block;font-size:11px;padding:1px 6px;border-radius:3px;` +
    `background:${bg};color:${fg};margin-left:6px">${text}</span>`;

  const rows = rank(postings, opts)
    .map((p) => {
      const h = highlight(p, opts);
      const badges =
        (h.preferred ? chip("Junior", "#FFF4E5", "#8A5200") : "") +
        (h.majorEmployer ? chip("Grand groupe", "#E8F0FE", "#1A4FA0") : "") +
        (h.matchesMonth && opts.month
          ? chip(`Mentionne ${opts.month}`, "#E6F4EA", "#136B32")
          : "") +
        (h.pay === "remunere" ? chip("Rémunéré", "#E6F4EA", "#136B32") : "") +
        (h.pay === "non-remunere" ? chip("Non rémunéré", "#FCE8E6", "#A8180B") : "");
      return `<li style="margin-bottom:10px">
  <a href="${escapeHtml(p.url)}"><strong>${escapeHtml(p.title)}</strong></a>${badges}<br>
  <span style="color:#555">${escapeHtml(p.employer)} · ${escapeHtml(p.location)}${
        p.timeType ? ` · ${escapeHtml(p.timeType)}` : ""
      }${p.postedOn ? ` · ${escapeHtml(p.postedOn)}` : ""}</span>${
        p.closesOn
          ? `<br><span style="color:#b00">Clôture : ${escapeHtml(p.closesOn)}</span>`
          : ""
      }
</li>`;
    })
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
