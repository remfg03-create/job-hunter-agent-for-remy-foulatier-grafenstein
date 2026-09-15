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
    // Les noms d'employeurs sont bannis de l'objet : au-delà de trois offres il
    // devenait illisible. Ils restent dans le corps du message.
    expect(r.subject).not.toContain("Tennis Australia");
    expect(r.html).toContain("Tennis Australia");
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
