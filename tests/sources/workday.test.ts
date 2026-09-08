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
