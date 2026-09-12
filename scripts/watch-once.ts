#!/usr/bin/env tsx
/**
 * Un passage de veille depuis le terminal ou depuis GitHub Actions.
 *
 * Usage :
 *   npm run watch
 *   WATCH_STATE_PATH=data/watch-state.json npx tsx scripts/watch-once.ts
 */

import { runWatch } from "../src/lib/watch";
import { renderAlert } from "../src/lib/alert-email";

async function loadEnv() {
  try {
    const { config } = await import("dotenv");
    config({ path: ".env.local" });
    config();
  } catch {
    /* dotenv absent : les variables viennent du shell */
  }
}

async function main() {
  await loadEnv();
  const statePath = process.env.WATCH_STATE_PATH || "data/watch-state.json";

  const { newPostings, brokenSources, rejected } = await runWatch({ statePath });

  console.log(`Nouvelles offres : ${newPostings.length}`);
  for (const p of newPostings) {
    console.log(`  • ${p.title} — ${p.employer} (${p.location})`);
    console.log(`    ${p.url}`);
  }
  if (rejected.length) {
    const horsZone = rejected.filter((r) => r.reason === "hors-zone").length;
    const horsProfil = rejected.filter((r) => r.reason === "hors-profil").length;
    console.log(
      `Écartées : ${rejected.length} (${horsZone} hors zone, ${horsProfil} hors profil)`
    );
    for (const r of rejected) {
      console.log(`  – ${r.posting.title} — ${r.posting.location} [${r.reason}]`);
    }
  }
  if (brokenSources.length) console.log(`Sources cassées : ${brokenSources.join(", ")}`);

  const alert = renderAlert(newPostings, brokenSources);
  if (!alert) {
    console.log("Rien à signaler — aucune alerte envoyée.");
    return;
  }

  const to = process.env.ALERT_EMAIL_TO;
  if (!to) {
    console.log(`ALERT_EMAIL_TO absent — alerte non envoyée. Sujet : ${alert.subject}`);
    return;
  }

  const { gmailConfig, sendHtmlMessage } = await import("../src/lib/gmail");
  if (!gmailConfig()?.refreshToken) {
    console.log(`Gmail non configuré — alerte non envoyée. Sujet : ${alert.subject}`);
    return;
  }
  await sendHtmlMessage({ to, subject: alert.subject, html: alert.html });
  console.log(`Alerte envoyée à ${to} : ${alert.subject}`);
}

main().catch((e) => {
  console.error("Passage de veille en échec :", e);
  process.exit(1);
});
