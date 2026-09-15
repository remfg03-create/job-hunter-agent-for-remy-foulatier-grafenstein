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
import { PROFILES, type Profile } from "../src/lib/profiles";

async function loadEnv() {
  try {
    const { config } = await import("dotenv");
    config({ path: ".env.local" });
    config();
  } catch {
    /* dotenv absent : les variables viennent du shell */
  }
}

async function runProfile(profile: Profile, stateDir: string): Promise<void> {
  const to = process.env[profile.recipientEnv];
  console.log(`\n━━━ ${profile.label} ━━━`);

  const statePath = `${stateDir}/watch-state-${profile.id}.json`;
  const { newPostings, brokenSources, rejected } = await runWatch({
    statePath,
    targets: profile.targets,
    screening: profile.screening,
  });

  console.log(`Nouvelles offres : ${newPostings.length}`);
  for (const p of newPostings) {
    console.log(`  • ${p.title} — ${p.employer} (${p.location})`);
    console.log(`    ${p.url}`);
  }
  if (rejected.length) {
    const z = rejected.filter((r) => r.reason === "hors-zone").length;
    const pr = rejected.filter((r) => r.reason === "hors-profil").length;
    const sr = rejected.filter((r) => r.reason === "trop-senior").length;
    const hd = rejected.filter((r) => r.reason === "hors-domaine").length;
    console.log(
      `Écartées : ${rejected.length} (${z} hors zone, ${pr} hors profil, ` +
        `${sr} trop senior, ${hd} hors domaine)`
    );
  }
  if (brokenSources.length) console.log(`Sources cassées : ${brokenSources.join(", ")}`);

  const alert = renderAlert(newPostings, brokenSources);
  if (!alert) {
    console.log("Rien à signaler — aucune alerte envoyée.");
    return;
  }
  if (!to) {
    console.log(`${profile.recipientEnv} absent — alerte non envoyée : ${alert.subject}`);
    return;
  }

  const { mailerConfig, sendAlert } = await import("../src/lib/mailer");
  const cfg = mailerConfig();
  if (!cfg) {
    console.log(`Envoi non configuré — alerte non envoyée : ${alert.subject}`);
    return;
  }
  const id = await sendAlert({ ...cfg, to }, alert.subject, alert.html);
  console.log(`Alerte envoyée à ${to} : ${alert.subject} (${id})`);
}

async function main() {
  await loadEnv();
  // Un fichier d'état par profil, tous dans le même dossier versionné.
  const stateDir = process.env.WATCH_STATE_DIR || "data";
  const only = process.env.WATCH_PROFILE;
  const profiles = only ? PROFILES.filter((p) => p.id === only) : PROFILES;
  if (profiles.length === 0) throw new Error(`Profil inconnu : ${only}`);

  for (const profile of profiles) {
    try {
      await runProfile(profile, stateDir);
    } catch (err) {
      // L'échec d'un profil ne doit pas priver l'autre de ses alertes.
      console.error(`[${profile.id}] passage en échec : ${(err as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error("Passage de veille en échec :", e);
  process.exit(1);
});
