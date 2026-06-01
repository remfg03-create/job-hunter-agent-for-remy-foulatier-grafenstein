#!/usr/bin/env tsx
/**
 * Run one full job scan from the terminal (scrape → score → print).
 *
 * Usage:
 *   npm run scan
 *   npx tsx scripts/scan-once.ts
 *
 * Reads ANTHROPIC_API_KEY from the environment / .env.local for real AI scoring;
 * without it, a transparent keyword heuristic is used so the flow still works.
 */

import { runScan } from "../src/lib/scan";

// Best-effort load of .env.local for local runs (no hard dependency on dotenv).
async function loadEnv() {
  try {
    const { config } = await import("dotenv");
    config({ path: ".env.local" });
    config();
  } catch {
    /* dotenv not installed — env vars can still come from the shell */
  }
}

async function main() {
  await loadEnv();
  console.log("🔎 Scanning 5 job boards…\n");
  const result = await runScan();

  console.log("Sources:");
  for (const s of result.perSource) {
    const tag = s.live > 0 ? `${s.live} live` : `${s.sample} sample (fallback)`;
    console.log(`  • ${s.name.padEnd(24)} ${tag}`);
  }
  console.log(`\nCV: ${result.cvFilename}${result.usedSampleCV ? " (bundled sample)" : ""}`);
  console.log(`\nTop matches (${result.jobs.length} total):\n`);

  for (const j of result.jobs.slice(0, 10)) {
    console.log(`  [${String(j.score).padStart(2)}/10] ${j.title} — ${j.company} (${j.location})`);
    console.log(`         ✓ ${j.matchingSkills.slice(0, 5).join(", ") || "—"}`);
    if (j.missingSkills.length) console.log(`         ✗ ${j.missingSkills.slice(0, 4).join(", ")}`);
  }
  console.log("\n✅ Scan complete.");
}

main().catch((e) => {
  console.error("Scan failed:", e);
  process.exit(1);
});
