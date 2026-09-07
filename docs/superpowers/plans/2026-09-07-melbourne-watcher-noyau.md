# Veilleur Melbourne — noyau fonctionnel : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un veilleur qui interroge le board Workday de Tennis Australia, détecte les offres nouvelles depuis le dernier passage, et envoie une alerte mail — le tout piloté par GitHub Actions.

**Architecture:** Un connecteur `workday` générique produit des `JobPosting` normalisés. Un état JSON versionné sur une branche `data` mémorise les identifiants déjà vus ; la détection de nouveauté est une comparaison d'ensembles contre cet état. Un runner orchestre connecteurs → diff → alerte → sauvegarde de l'état. GitHub Actions exécute le runner sur cron et commite l'état mis à jour.

**Tech Stack:** TypeScript, Node 20, Vitest, `googleapis` (Gmail, déjà présent), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-07-melbourne-job-watcher-design.md`

## Global Constraints

- Branche de travail : `melbourne-watcher`. Ne jamais commiter sur `main`.
- Alias d'import : `@/*` → `./src/*` (défini dans `tsconfig.json`, à redéclarer pour Vitest).
- **Aucun repli sur données fictives.** Un connecteur qui échoue lève une erreur ; le runner l'enregistre comme échec. Ne jamais substituer de données d'exemple.
- Toutes les dates persistées sont des chaînes ISO 8601 UTC.
- Les identifiants d'offre sont stables et préfixés par la source : `workday:<tenant>:<requisitionId>`.
- Node 20 minimum (`fetch` natif, pas de dépendance HTTP supplémentaire).
- Ce plan ne touche ni au dashboard, ni au scoring IA, ni aux 5 anciens scrapers. Ils sont traités dans des plans ultérieurs.

---

### Task 1 : Socle de test et connecteur Workday

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/sources/types.ts`
- Create: `src/lib/sources/workday.ts`
- Create: `tests/fixtures/workday-tennis.json`
- Create: `tests/sources/workday.test.ts`
- Modify: `package.json` (devDependency `vitest`, script `test`)

**Interfaces:**
- Consomme : rien (première tâche).
- Produit : `JobPosting`, `WorkdayConfig`, `parseWorkdayJobs(cfg, payload): JobPosting[]`, `fetchWorkdayJobs(cfg, limit?): Promise<JobPosting[]>`.

- [ ] **Step 1 : Installer Vitest et déclarer le script**

```bash
npm install -D vitest@^2.1.0
```

Puis ajouter dans `package.json`, dans `"scripts"` :

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2 : Configurer Vitest avec l'alias `@`**

Créer `vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 3 : Capturer une vraie réponse Workday comme fixture**

```bash
mkdir -p tests/fixtures tests/sources
curl -s -X POST "https://tennis.wd3.myworkdayjobs.com/wday/cxs/tennis/ta_careers/jobs" \
  -H "Content-Type: application/json" \
  -d '{"appliedFacets":{},"limit":20,"offset":0,"searchText":""}' \
  -o tests/fixtures/workday-tennis.json
```

Vérifier que le fichier contient bien `"jobPostings"` et un `"total"` non nul :

```bash
node -e "const d=require('./tests/fixtures/workday-tennis.json');console.log(d.total,d.jobPostings.length)"
```

Si `total` vaut 0, ne pas continuer : l'employeur n'a temporairement aucune offre et la fixture serait inutilisable. Utiliser à la place une fixture d'un autre tenant Workday ayant des offres.

- [ ] **Step 4 : Écrire le test qui échoue**

Créer `tests/sources/workday.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseWorkdayJobs } from "@/lib/sources/workday";

const payload = JSON.parse(
  readFileSync("tests/fixtures/workday-tennis.json", "utf-8")
);
const cfg = { tenant: "tennis", site: "ta_careers", employer: "Tennis Australia" };

describe("parseWorkdayJobs", () => {
  it("normalise chaque offre de la réponse Workday", () => {
    const jobs = parseWorkdayJobs(cfg, payload);
    expect(jobs.length).toBe(payload.jobPostings.length);
    const j = jobs[0];
    expect(j.employer).toBe("Tennis Australia");
    expect(j.source).toBe("workday:tennis");
    expect(j.title).toBeTruthy();
    expect(j.url).toMatch(/^https:\/\/tennis\.wd3\.myworkdayjobs\.com\/en-US\/ta_careers\//);
  });

  it("construit un identifiant stable et préfixé par la source", () => {
    const jobs = parseWorkdayJobs(cfg, payload);
    for (const j of jobs) expect(j.id).toMatch(/^workday:tennis:.+/);
    expect(new Set(jobs.map((j) => j.id)).size).toBe(jobs.length);
  });

  it("produit deux fois le même identifiant pour la même offre", () => {
    const a = parseWorkdayJobs(cfg, payload);
    const b = parseWorkdayJobs(cfg, payload);
    expect(a.map((j) => j.id)).toEqual(b.map((j) => j.id));
  });

  it("lève une erreur si la charge utile n'a pas la forme attendue", () => {
    expect(() => parseWorkdayJobs(cfg, { nope: true })).toThrow(/jobPostings/);
  });

  it("ignore une offre sans externalPath plutôt que de produire une URL cassée", () => {
    const jobs = parseWorkdayJobs(cfg, {
      jobPostings: [{ title: "Sans chemin" }, ...payload.jobPostings.slice(0, 1)],
    });
    expect(jobs.length).toBe(1);
  });
});
```

- [ ] **Step 5 : Lancer le test et vérifier qu'il échoue**

Run: `npx vitest run tests/sources/workday.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/sources/workday"`

- [ ] **Step 6 : Définir les types partagés**

Créer `src/lib/sources/types.ts` :

```ts
/** Une offre normalisée, quelle que soit sa source. */
export interface JobPosting {
  /** Identifiant stable et unique, préfixé par la source : "workday:tennis:R5163-1". */
  id: string;
  /** Identifiant de la source : "workday:tennis". */
  source: string;
  /** Nom lisible de l'employeur. */
  employer: string;
  title: string;
  location: string;
  /** Lien public vers l'annonce. */
  url: string;
  /** Texte de publication tel que fourni par la source ("Posted Today"). */
  postedOn?: string;
  /** Temps plein / temps partiel, tel que fourni par la source. */
  timeType?: string;
}
```

- [ ] **Step 7 : Implémenter le connecteur**

Créer `src/lib/sources/workday.ts` :

```ts
/**
 * Connecteur Workday.
 *
 * Workday expose une API JSON publique et non authentifiée sur ses portails
 * carrières. Validé le 2026-09-07 sur Tennis Australia (19 offres réelles).
 * Générique : paramétré par tenant + site, donc réutilisable pour tout
 * employeur hébergé sur Workday.
 */

import type { JobPosting } from "./types";

export interface WorkdayConfig {
  /** Sous-domaine du portail : "tennis" dans tennis.wd3.myworkdayjobs.com. */
  tenant: string;
  /** Nom du site carrières : "ta_careers". */
  site: string;
  /** Nom lisible de l'employeur, reporté tel quel sur chaque offre. */
  employer: string;
}

interface WorkdayPosting {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  timeType?: string;
}

function base(cfg: WorkdayConfig): string {
  return `https://${cfg.tenant}.wd3.myworkdayjobs.com`;
}

/** Dernier segment de l'externalPath — l'identifiant de réquisition. */
function requisitionId(externalPath: string): string {
  const parts = externalPath.split("/").filter(Boolean);
  return parts[parts.length - 1];
}

export function parseWorkdayJobs(cfg: WorkdayConfig, payload: unknown): JobPosting[] {
  const postings = (payload as { jobPostings?: unknown })?.jobPostings;
  if (!Array.isArray(postings)) {
    throw new Error("Réponse Workday inattendue : jobPostings absent ou non tableau");
  }

  const jobs: JobPosting[] = [];
  for (const raw of postings as WorkdayPosting[]) {
    if (!raw.externalPath) continue; // sans chemin, pas d'URL fiable ni d'identifiant
    jobs.push({
      id: `workday:${cfg.tenant}:${requisitionId(raw.externalPath)}`,
      source: `workday:${cfg.tenant}`,
      employer: cfg.employer,
      title: raw.title?.trim() || "Sans titre",
      location: raw.locationsText?.trim() || "",
      url: `${base(cfg)}/en-US/${cfg.site}${raw.externalPath}`,
      postedOn: raw.postedOn,
      timeType: raw.timeType,
    });
  }
  return jobs;
}

/** Interroge le portail et retourne les offres normalisées. Lève en cas d'échec. */
export async function fetchWorkdayJobs(
  cfg: WorkdayConfig,
  limit = 20
): Promise<JobPosting[]> {
  const url = `${base(cfg)}/wday/cxs/${cfg.tenant}/${cfg.site}/jobs`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit, offset: 0, searchText: "" }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Workday ${cfg.tenant} a répondu ${res.status}`);
    return parseWorkdayJobs(cfg, await res.json());
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 8 : Lancer le test et vérifier qu'il passe**

Run: `npx vitest run tests/sources/workday.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 9 : Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/sources tests/
git commit -m "feat(sources): connecteur Workday générique + socle Vitest"
```

---

### Task 2 : État persistant et santé des sources

**Files:**
- Create: `src/lib/state.ts`
- Create: `tests/state.test.ts`

**Interfaces:**
- Consomme : `JobPosting` de `@/lib/sources/types`.
- Produit : `WatchState`, `emptyState()`, `loadState(path)`, `saveState(path, state)`, `recordSuccess(state, sourceId, now)`, `recordFailure(state, sourceId, now)`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/state.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  emptyState, loadState, saveState, recordSuccess, recordFailure,
} from "@/lib/state";

const NOW = "2026-09-07T10:00:00.000Z";

describe("state", () => {
  it("retourne un état vide quand le fichier n'existe pas", async () => {
    const s = await loadState(join(mkdtempSync(join(tmpdir(), "w-")), "absent.json"));
    expect(s.knownJobIds).toEqual([]);
    expect(s.lastRunAt).toBeNull();
    expect(s.version).toBe(1);
  });

  it("relit à l'identique ce qu'il a écrit", async () => {
    const p = join(mkdtempSync(join(tmpdir(), "w-")), "state.json");
    const s = { ...emptyState(), lastRunAt: NOW, knownJobIds: ["workday:tennis:R1"] };
    await saveState(p, s);
    expect(await loadState(p)).toEqual(s);
  });

  it("retourne un état vide plutôt que de planter sur un JSON corrompu", async () => {
    const p = join(mkdtempSync(join(tmpdir(), "w-")), "state.json");
    writeFileSync(p, "{ pas du json");
    expect((await loadState(p)).knownJobIds).toEqual([]);
  });

  it("remet le compteur d'échecs à zéro sur un succès", () => {
    let s = emptyState();
    s = recordFailure(s, "workday:tennis", NOW);
    s = recordFailure(s, "workday:tennis", NOW);
    expect(s.sourceHealth["workday:tennis"].consecutiveFailures).toBe(2);
    s = recordSuccess(s, "workday:tennis", NOW);
    expect(s.sourceHealth["workday:tennis"].consecutiveFailures).toBe(0);
    expect(s.sourceHealth["workday:tennis"].lastSuccessAt).toBe(NOW);
  });

  it("incrémente les échecs consécutifs et horodate le dernier", () => {
    let s = emptyState();
    s = recordFailure(s, "workday:tennis", NOW);
    expect(s.sourceHealth["workday:tennis"].lastErrorAt).toBe(NOW);
    expect(s.sourceHealth["workday:tennis"].lastSuccessAt).toBeNull();
  });

  it("ne mute pas l'état passé en argument", () => {
    const s = emptyState();
    recordFailure(s, "workday:tennis", NOW);
    expect(s.sourceHealth["workday:tennis"]).toBeUndefined();
  });
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

Run: `npx vitest run tests/state.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/state"`

- [ ] **Step 3 : Implémenter l'état**

Créer `src/lib/state.ts` :

```ts
/**
 * État du veilleur, persisté en JSON sur la branche `data`.
 *
 * Contient les identifiants d'offres déjà vues — c'est cette liste qui permet
 * de distinguer une offre nouvelle d'une offre déjà signalée — et la santé de
 * chaque source, pour alerter quand un connecteur casse.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface SourceHealth {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  consecutiveFailures: number;
}

export interface WatchState {
  version: 1;
  lastRunAt: string | null;
  /** Identifiants de toutes les offres déjà rencontrées, tous employeurs confondus. */
  knownJobIds: string[];
  sourceHealth: Record<string, SourceHealth>;
}

export function emptyState(): WatchState {
  return { version: 1, lastRunAt: null, knownJobIds: [], sourceHealth: {} };
}

/** Lit l'état. Un fichier absent ou illisible donne un état vide, jamais une erreur. */
export async function loadState(path: string): Promise<WatchState> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf-8")) as Partial<WatchState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.knownJobIds)) return emptyState();
    return {
      version: 1,
      lastRunAt: parsed.lastRunAt ?? null,
      knownJobIds: parsed.knownJobIds,
      sourceHealth: parsed.sourceHealth ?? {},
    };
  } catch {
    return emptyState();
  }
}

export async function saveState(path: string, state: WatchState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + "\n", "utf-8");
}

function health(state: WatchState, sourceId: string): SourceHealth {
  return (
    state.sourceHealth[sourceId] ?? {
      lastSuccessAt: null, lastErrorAt: null, consecutiveFailures: 0,
    }
  );
}

export function recordSuccess(state: WatchState, sourceId: string, now: string): WatchState {
  const h = health(state, sourceId);
  return {
    ...state,
    sourceHealth: {
      ...state.sourceHealth,
      [sourceId]: { ...h, lastSuccessAt: now, consecutiveFailures: 0 },
    },
  };
}

export function recordFailure(state: WatchState, sourceId: string, now: string): WatchState {
  const h = health(state, sourceId);
  return {
    ...state,
    sourceHealth: {
      ...state.sourceHealth,
      [sourceId]: { ...h, lastErrorAt: now, consecutiveFailures: h.consecutiveFailures + 1 },
    },
  };
}
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

Run: `npx vitest run tests/state.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5 : Commit**

```bash
git add src/lib/state.ts tests/state.test.ts
git commit -m "feat(state): état persistant du veilleur + santé des sources"
```

---

### Task 3 : Détection de nouveauté

**Files:**
- Create: `src/lib/diff.ts`
- Create: `tests/diff.test.ts`

**Interfaces:**
- Consomme : `WatchState` de `@/lib/state`, `JobPosting` de `@/lib/sources/types`.
- Produit : `findNewPostings(state, postings): JobPosting[]`, `applyPostings(state, postings, now): WatchState`.

C'est le cœur du veilleur : la couverture de tests y est prioritaire.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/diff.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { findNewPostings, applyPostings } from "@/lib/diff";
import { emptyState } from "@/lib/state";
import type { JobPosting } from "@/lib/sources/types";

const NOW = "2026-09-07T10:00:00.000Z";
const job = (id: string): JobPosting => ({
  id, source: "workday:tennis", employer: "Tennis Australia",
  title: `Poste ${id}`, location: "Melbourne VIC",
  url: `https://example.test/${id}`,
});

describe("findNewPostings", () => {
  it("considère tout comme nouveau au tout premier passage", () => {
    expect(findNewPostings(emptyState(), [job("a"), job("b")]).map((j) => j.id))
      .toEqual(["a", "b"]);
  });

  it("ne retourne que ce qui n'a jamais été vu", () => {
    const s = applyPostings(emptyState(), [job("a")], NOW);
    expect(findNewPostings(s, [job("a"), job("b")]).map((j) => j.id)).toEqual(["b"]);
  });

  it("ne signale rien quand rien n'a changé", () => {
    const s = applyPostings(emptyState(), [job("a"), job("b")], NOW);
    expect(findNewPostings(s, [job("a"), job("b")])).toEqual([]);
  });

  it("ne resignale pas une offre disparue puis réapparue", () => {
    let s = applyPostings(emptyState(), [job("a")], NOW);
    s = applyPostings(s, [], NOW);              // l'offre disparaît du board
    expect(findNewPostings(s, [job("a")])).toEqual([]); // elle revient : déjà connue
  });

  it("dédoublonne les offres remontées deux fois dans le même passage", () => {
    expect(findNewPostings(emptyState(), [job("a"), job("a")]).map((j) => j.id))
      .toEqual(["a"]);
  });
});

describe("applyPostings", () => {
  it("mémorise les identifiants et horodate le passage", () => {
    const s = applyPostings(emptyState(), [job("a"), job("b")], NOW);
    expect(s.knownJobIds.sort()).toEqual(["a", "b"]);
    expect(s.lastRunAt).toBe(NOW);
  });

  it("n'oublie jamais un identifiant déjà connu", () => {
    let s = applyPostings(emptyState(), [job("a")], NOW);
    s = applyPostings(s, [job("b")], NOW);
    expect(s.knownJobIds.sort()).toEqual(["a", "b"]);
  });

  it("n'introduit pas de doublon dans knownJobIds", () => {
    let s = applyPostings(emptyState(), [job("a")], NOW);
    s = applyPostings(s, [job("a")], NOW);
    expect(s.knownJobIds).toEqual(["a"]);
  });

  it("ne mute pas l'état passé en argument", () => {
    const s = emptyState();
    applyPostings(s, [job("a")], NOW);
    expect(s.knownJobIds).toEqual([]);
  });
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

Run: `npx vitest run tests/diff.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/diff"`

- [ ] **Step 3 : Implémenter la détection**

Créer `src/lib/diff.ts` :

```ts
/**
 * Détection de nouveauté.
 *
 * Une offre est « nouvelle » si son identifiant n'apparaît pas dans l'état.
 * Les identifiants ne sont jamais retirés de l'état : une offre qui disparaît
 * du board puis réapparaît ne doit pas déclencher une seconde alerte.
 */

import type { JobPosting } from "@/lib/sources/types";
import type { WatchState } from "@/lib/state";

export function findNewPostings(state: WatchState, postings: JobPosting[]): JobPosting[] {
  const known = new Set(state.knownJobIds);
  const seen = new Set<string>();
  const fresh: JobPosting[] = [];
  for (const p of postings) {
    if (known.has(p.id) || seen.has(p.id)) continue;
    seen.add(p.id);
    fresh.push(p);
  }
  return fresh;
}

export function applyPostings(
  state: WatchState,
  postings: JobPosting[],
  now: string
): WatchState {
  const ids = new Set(state.knownJobIds);
  for (const p of postings) ids.add(p.id);
  return { ...state, knownJobIds: [...ids], lastRunAt: now };
}
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

Run: `npx vitest run tests/diff.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5 : Commit**

```bash
git add src/lib/diff.ts tests/diff.test.ts
git commit -m "feat(diff): détection des offres nouvelles depuis le dernier passage"
```

---

### Task 4 : Liste d'employeurs surveillés

**Files:**
- Create: `src/lib/watchlist.ts`
- Create: `tests/watchlist.test.ts`

**Interfaces:**
- Consomme : `WorkdayConfig` de `@/lib/sources/workday`.
- Produit : `WatchTarget`, `WATCHLIST: WatchTarget[]`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/watchlist.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { WATCHLIST } from "@/lib/watchlist";

describe("WATCHLIST", () => {
  it("n'est pas vide", () => {
    expect(WATCHLIST.length).toBeGreaterThan(0);
  });

  it("a des identifiants de cible uniques", () => {
    expect(new Set(WATCHLIST.map((t) => t.id)).size).toBe(WATCHLIST.length);
  });

  it("contient Tennis Australia, le seul identifiant validé à ce jour", () => {
    const ta = WATCHLIST.find((t) => t.id === "tennis-australia");
    expect(ta).toBeDefined();
    expect(ta!.workday).toEqual({
      tenant: "tennis", site: "ta_careers", employer: "Tennis Australia",
    });
  });

  it("ne déclare que des cibles de type workday dans cette version", () => {
    for (const t of WATCHLIST) expect(t.type).toBe("workday");
  });
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

Run: `npx vitest run tests/watchlist.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/watchlist"`

- [ ] **Step 3 : Implémenter la watchlist**

Créer `src/lib/watchlist.ts` :

```ts
/**
 * Employeurs surveillés à Melbourne.
 *
 * ATTENTION — règle de validation : ne jamais ajouter une cible sur la seule
 * foi d'un code HTTP. L'API SmartRecruiters répond 200 / totalFound:0 pour tout
 * identifiant inexistant, ce qui produit de faux positifs indiscernables d'un
 * employeur réel sans poste ouvert. Chaque identifiant doit être confirmé
 * depuis la page carrières officielle de l'employeur.
 */

import type { WorkdayConfig } from "@/lib/sources/workday";

export interface WatchTarget {
  /** Identifiant interne stable, en kebab-case. */
  id: string;
  employer: string;
  type: "workday";
  workday: WorkdayConfig;
  /** "high" : les nouveautés déclenchent une alerte immédiate. */
  priority: "high" | "normal";
}

export const WATCHLIST: WatchTarget[] = [
  {
    id: "tennis-australia",
    employer: "Tennis Australia",
    type: "workday",
    // Validé le 2026-09-07 : 19 offres réelles, dont 11 à Melbourne.
    workday: { tenant: "tennis", site: "ta_careers", employer: "Tennis Australia" },
    priority: "high",
  },
];
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

Run: `npx vitest run tests/watchlist.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5 : Commit**

```bash
git add src/lib/watchlist.ts tests/watchlist.test.ts
git commit -m "feat(watchlist): cibles surveillées, Tennis Australia validée"
```

---

### Task 5 : Rendu de l'alerte mail

**Files:**
- Create: `src/lib/alert-email.ts`
- Create: `tests/alert-email.test.ts`

**Interfaces:**
- Consomme : `JobPosting` de `@/lib/sources/types`.
- Produit : `renderAlert(postings, brokenSources): { subject: string; html: string } | null`.

L'envoi effectif réutilise `createDraft` de `src/lib/gmail.ts` (portée `gmail.compose`, qui autorise aussi l'envoi). Cette tâche ne couvre que le rendu, testable sans réseau.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/alert-email.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { renderAlert } from "@/lib/alert-email";
import type { JobPosting } from "@/lib/sources/types";

const job = (id: string, title: string): JobPosting => ({
  id, source: "workday:tennis", employer: "Tennis Australia",
  title, location: "Melbourne VIC", url: `https://example.test/${id}`,
  postedOn: "Posted Today", timeType: "Part time",
});

describe("renderAlert", () => {
  it("ne rend rien quand il n'y a ni offre ni source cassée", () => {
    expect(renderAlert([], [])).toBeNull();
  });

  it("annonce le nombre d'offres dans l'objet", () => {
    const r = renderAlert([job("a", "Site Supervisor")], [])!;
    expect(r.subject).toContain("1");
    expect(r.subject).toContain("Tennis Australia");
  });

  it("liste chaque offre avec son titre, son lieu et son lien", () => {
    const r = renderAlert(
      [job("a", "Site Supervisor"), job("b", "Retail Coordinator")], []
    )!;
    expect(r.html).toContain("Site Supervisor");
    expect(r.html).toContain("Retail Coordinator");
    expect(r.html).toContain("Melbourne VIC");
    expect(r.html).toContain("https://example.test/a");
  });

  it("échappe le HTML présent dans un titre d'offre", () => {
    const r = renderAlert([job("a", "<script>alert(1)</script>")], [])!;
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("signale les sources cassées même sans offre nouvelle", () => {
    const r = renderAlert([], ["workday:tennis"])!;
    expect(r.subject.toLowerCase()).toContain("source");
    expect(r.html).toContain("workday:tennis");
  });
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

Run: `npx vitest run tests/alert-email.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/alert-email"`

- [ ] **Step 3 : Implémenter le rendu**

Créer `src/lib/alert-email.ts` :

```ts
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
  const subject =
    postings.length > 0
      ? `${postings.length} nouvelle${postings.length > 1 ? "s" : ""} offre${
          postings.length > 1 ? "s" : ""
        } — ${employers.join(", ")}`
      : `Veilleur : ${brokenSources.length} source${
          brokenSources.length > 1 ? "s" : ""
        } en échec`;

  const rows = postings
    .map(
      (p) => `<li style="margin-bottom:10px">
  <a href="${escapeHtml(p.url)}"><strong>${escapeHtml(p.title)}</strong></a><br>
  <span style="color:#555">${escapeHtml(p.employer)} · ${escapeHtml(p.location)}${
        p.timeType ? ` · ${escapeHtml(p.timeType)}` : ""
      }${p.postedOn ? ` · ${escapeHtml(p.postedOn)}` : ""}</span>
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
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

Run: `npx vitest run tests/alert-email.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5 : Commit**

```bash
git add src/lib/alert-email.ts tests/alert-email.test.ts
git commit -m "feat(alerts): rendu de l'alerte mail du veilleur"
```

---

### Task 6 : Runner du veilleur et script CLI

**Files:**
- Create: `src/lib/watch.ts`
- Create: `tests/watch.test.ts`
- Create: `scripts/watch-once.ts`
- Modify: `package.json` (script `watch`)

**Interfaces:**
- Consomme : `WATCHLIST`, `fetchWorkdayJobs`, `loadState`/`saveState`/`recordSuccess`/`recordFailure`, `findNewPostings`/`applyPostings`.
- Produit : `runWatch(opts): Promise<WatchRunResult>` avec `WatchRunResult = { newPostings: JobPosting[]; brokenSources: string[]; state: WatchState }`.

L'injection du fetcher en option rend le runner testable sans réseau.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/watch.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runWatch } from "@/lib/watch";
import { loadState } from "@/lib/state";
import type { JobPosting } from "@/lib/sources/types";

const NOW = "2026-09-07T10:00:00.000Z";
const statePath = () => join(mkdtempSync(join(tmpdir(), "w-")), "state.json");
const job = (id: string): JobPosting => ({
  id, source: "workday:tennis", employer: "Tennis Australia",
  title: `Poste ${id}`, location: "Melbourne VIC", url: `https://example.test/${id}`,
});

describe("runWatch", () => {
  it("signale toutes les offres au premier passage", async () => {
    const r = await runWatch({
      statePath: statePath(), now: NOW,
      fetcher: async () => [job("a"), job("b")],
    });
    expect(r.newPostings.map((j) => j.id)).toEqual(["a", "b"]);
    expect(r.brokenSources).toEqual([]);
  });

  it("ne resignale rien au second passage identique", async () => {
    const p = statePath();
    const fetcher = async () => [job("a")];
    await runWatch({ statePath: p, now: NOW, fetcher });
    const second = await runWatch({ statePath: p, now: NOW, fetcher });
    expect(second.newPostings).toEqual([]);
  });

  it("persiste l'état sur disque entre deux passages", async () => {
    const p = statePath();
    await runWatch({ statePath: p, now: NOW, fetcher: async () => [job("a")] });
    expect((await loadState(p)).knownJobIds).toEqual(["a"]);
  });

  it("continue malgré l'échec d'une source et la déclare cassée après 3 échecs", async () => {
    const p = statePath();
    const failing = async () => { throw new Error("HTTP 503"); };
    let r = await runWatch({ statePath: p, now: NOW, fetcher: failing });
    expect(r.brokenSources).toEqual([]);          // 1 échec : pas encore d'alerte
    r = await runWatch({ statePath: p, now: NOW, fetcher: failing });
    expect(r.brokenSources).toEqual([]);          // 2 échecs
    r = await runWatch({ statePath: p, now: NOW, fetcher: failing });
    expect(r.brokenSources).toEqual(["workday:tennis"]); // 3 échecs : alerte
  });

  it("n'invente jamais d'offre quand une source échoue", async () => {
    const r = await runWatch({
      statePath: statePath(), now: NOW,
      fetcher: async () => { throw new Error("HTTP 503"); },
    });
    expect(r.newPostings).toEqual([]);
  });
});
```

- [ ] **Step 2 : Lancer le test et vérifier qu'il échoue**

Run: `npx vitest run tests/watch.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/watch"`

- [ ] **Step 3 : Implémenter le runner**

Créer `src/lib/watch.ts` :

```ts
/**
 * Orchestration d'un passage de veille :
 * sources → détection de nouveauté → santé des sources → sauvegarde de l'état.
 *
 * L'envoi de l'alerte est laissé à l'appelant (script CLI), pour que le runner
 * reste testable sans réseau ni identifiants Gmail.
 */

import { WATCHLIST, type WatchTarget } from "@/lib/watchlist";
import { fetchWorkdayJobs } from "@/lib/sources/workday";
import type { JobPosting } from "@/lib/sources/types";
import {
  loadState, saveState, recordSuccess, recordFailure, type WatchState,
} from "@/lib/state";
import { findNewPostings, applyPostings } from "@/lib/diff";

/** Nombre d'échecs consécutifs avant de déclarer une source cassée. */
export const BROKEN_AFTER_FAILURES = 3;

export type Fetcher = (target: WatchTarget) => Promise<JobPosting[]>;

export interface WatchRunResult {
  newPostings: JobPosting[];
  /** Sources ayant atteint le seuil d'échecs consécutifs. */
  brokenSources: string[];
  state: WatchState;
}

const defaultFetcher: Fetcher = (target) => fetchWorkdayJobs(target.workday);

export async function runWatch(opts: {
  statePath: string;
  now?: string;
  targets?: WatchTarget[];
  fetcher?: Fetcher;
}): Promise<WatchRunResult> {
  const now = opts.now ?? new Date().toISOString();
  const targets = opts.targets ?? WATCHLIST;
  const fetcher = opts.fetcher ?? defaultFetcher;

  let state = await loadState(opts.statePath);
  const collected: JobPosting[] = [];
  const broken: string[] = [];

  for (const target of targets) {
    const sourceId = `workday:${target.workday.tenant}`;
    try {
      collected.push(...(await fetcher(target)));
      state = recordSuccess(state, sourceId, now);
    } catch (err) {
      console.warn(`[watch] ${sourceId} en échec — ${(err as Error).message}`);
      state = recordFailure(state, sourceId, now);
      if (state.sourceHealth[sourceId].consecutiveFailures >= BROKEN_AFTER_FAILURES) {
        broken.push(sourceId);
      }
    }
  }

  const newPostings = findNewPostings(state, collected);
  state = applyPostings(state, collected, now);
  await saveState(opts.statePath, state);

  return { newPostings, brokenSources: broken, state };
}
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il passe**

Run: `npx vitest run tests/watch.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5 : Écrire le script CLI**

Créer `scripts/watch-once.ts` :

```ts
#!/usr/bin/env tsx
/**
 * Un passage de veille depuis le terminal ou depuis GitHub Actions.
 *
 * Usage :
 *   npm run watch
 *   WATCH_STATE_PATH=data/watch-state.json npx tsx scripts/watch-once.ts
 *
 * Sort en code 0 même si une source échoue : l'échec est enregistré dans l'état
 * et signalé par une alerte, il ne doit pas faire échouer le job Actions.
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

  const { newPostings, brokenSources } = await runWatch({ statePath });

  console.log(`Nouvelles offres : ${newPostings.length}`);
  for (const p of newPostings) {
    console.log(`  • ${p.title} — ${p.employer} (${p.location})`);
    console.log(`    ${p.url}`);
  }
  if (brokenSources.length) console.log(`Sources cassées : ${brokenSources.join(", ")}`);

  const alert = renderAlert(newPostings, brokenSources);
  if (!alert) {
    console.log("Rien à signaler — aucune alerte envoyée.");
    return;
  }

  const { gmailConfig, createDraft } = await import("../src/lib/gmail");
  const cfg = gmailConfig();
  if (!cfg) {
    console.log("Gmail non configuré — alerte non envoyée. Sujet :", alert.subject);
    return;
  }
  const to = process.env.ALERT_EMAIL_TO;
  if (!to) {
    console.log("ALERT_EMAIL_TO absent — alerte non envoyée.");
    return;
  }
  await createDraft({ to, subject: alert.subject, html: alert.html });
  console.log(`Alerte préparée dans Gmail : ${alert.subject}`);
}

main().catch((e) => {
  console.error("Passage de veille en échec :", e);
  process.exit(1);
});
```

- [ ] **Step 6 : Adapter l'appel à createDraft à sa signature réelle**

`createDraft` existe déjà dans `src/lib/gmail.ts`. Lire sa signature exacte :

```bash
sed -n '100,126p' src/lib/gmail.ts
```

Ajuster l'objet passé à `createDraft` dans `scripts/watch-once.ts` pour qu'il corresponde exactement aux paramètres attendus (noms de champs, présence éventuelle d'un paramètre de configuration OAuth). Puis vérifier que le projet compile :

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 7 : Déclarer le script npm**

Ajouter dans `package.json`, dans `"scripts"` :

```json
"watch": "tsx scripts/watch-once.ts"
```

- [ ] **Step 8 : Exécuter un vrai passage de bout en bout**

```bash
WATCH_STATE_PATH=/tmp/watch-state.json npm run watch
```

Expected: la liste des offres réelles de Tennis Australia s'affiche, avec « Nouvelles offres : N » où N > 0.

Relancer immédiatement la même commande :

```bash
WATCH_STATE_PATH=/tmp/watch-state.json npm run watch
```

Expected: « Nouvelles offres : 0 » et « Rien à signaler ». C'est la preuve que la détection de nouveauté fonctionne sur des données réelles.

- [ ] **Step 9 : Commit**

```bash
git add src/lib/watch.ts tests/watch.test.ts scripts/watch-once.ts package.json
git commit -m "feat(watch): runner du veilleur + script CLI"
```

---

### Task 7 : Automatisation GitHub Actions

**Files:**
- Create: `.github/workflows/watch.yml`
- Delete: `.github/workflows/cron-scan.yml`
- Modify: `vercel.json` (suppression du bloc `crons`)

**Interfaces:**
- Consomme : le script `npm run watch` de la tâche 6.
- Produit : un workflow planifié qui commite l'état sur la branche `data`.

- [ ] **Step 1 : Créer la branche `data` avec un état initial vide**

```bash
git switch --orphan data
git rm -rf . >/dev/null 2>&1 || true
mkdir -p data
echo '{"version":1,"lastRunAt":null,"knownJobIds":[],"sourceHealth":{}}' > data/watch-state.json
git add data/watch-state.json
git commit -m "chore(data): état initial du veilleur"
git switch melbourne-watcher
```

- [ ] **Step 2 : Écrire le workflow**

Créer `.github/workflows/watch.yml` :

```yaml
name: Veille emploi Melbourne

on:
  schedule:
    - cron: "0 */6 * * *" # 4 fois par jour
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  watch:
    runs-on: ubuntu-latest
    steps:
      - name: Récupérer le code
        uses: actions/checkout@v4
        with:
          ref: melbourne-watcher

      - name: Récupérer l'état dans data/
        uses: actions/checkout@v4
        with:
          ref: data
          path: .watch-data

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - run: npm ci

      - name: Passage de veille
        env:
          WATCH_STATE_PATH: .watch-data/data/watch-state.json
          ALERT_EMAIL_TO: ${{ secrets.ALERT_EMAIL_TO }}
          GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
          GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
          GOOGLE_REFRESH_TOKEN: ${{ secrets.GOOGLE_REFRESH_TOKEN }}
        run: npm run watch

      - name: Commiter l'état mis à jour
        working-directory: .watch-data
        run: |
          git config user.name "job-hunter-agent"
          git config user.email "actions@github.com"
          if git diff --quiet; then
            echo "Aucun changement d'état."
            exit 0
          fi
          git add data/watch-state.json
          git commit -m "chore(data): veille du $(date -u +%Y-%m-%dT%H:%MZ)"
          git push origin data
```

- [ ] **Step 3 : Valider la syntaxe du workflow**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/watch.yml')); print('YAML valide')"
```

Expected: `YAML valide`

- [ ] **Step 4 : Supprimer l'ancienne automatisation**

```bash
git rm .github/workflows/cron-scan.yml
```

Puis retirer le bloc `"crons"` de `vercel.json`, en conservant le bloc `"functions"`. Le fichier doit rester du JSON valide :

```bash
python3 -c "import json; d=json.load(open('vercel.json')); assert 'crons' not in d; print('vercel.json nettoyé')"
```

Expected: `vercel.json nettoyé`

- [ ] **Step 5 : Vérifier que toute la suite de tests passe**

```bash
npm test
```

Expected: PASS — 34 tests répartis sur 6 fichiers.

- [ ] **Step 6 : Commit**

```bash
git add .github vercel.json
git commit -m "ci: veille planifiée via GitHub Actions, suppression du cron Vercel"
```

- [ ] **Step 7 : Configurer les secrets du dépôt**

À faire manuellement dans GitHub → Settings → Secrets and variables → Actions :

| Secret | Valeur |
|---|---|
| `ALERT_EMAIL_TO` | remfg03@gmail.com |
| `GOOGLE_CLIENT_ID` | identifiant OAuth Google |
| `GOOGLE_CLIENT_SECRET` | secret OAuth Google |
| `GOOGLE_REFRESH_TOKEN` | jeton de rafraîchissement Gmail |

Puis déclencher un run manuel depuis l'onglet Actions (`workflow_dispatch`) et vérifier qu'un commit apparaît sur la branche `data`.

---

## Suites prévues

Ce plan livre une tranche verticale fonctionnelle. Les plans suivants, à rédiger séparément :

1. **Sources supplémentaires** — Adzuna AU, SmartRecruiters, ingestion des alertes mail LinkedIn/Seek, extraction Claude des pages carrières avec détection de changement (dont l'AGPC).
2. **Scoring recalibré** — prompt WHV 417 et profil franco-allemand, critère `whvFriendly`, prompt caching du CV, scoring des seules offres nouvelles, passage à `claude-sonnet-5`.
3. **Dashboard** — lecture de la branche `data` depuis Vercel, suppression des 5 anciens scrapers et du mécanisme de repli sur données fictives.
