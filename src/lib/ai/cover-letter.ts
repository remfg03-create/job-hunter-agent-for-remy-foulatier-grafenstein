/**
 * Cover-letter generator — writes a tailored letter for a specific job using
 * the candidate's CV and the AI's match analysis.
 *
 * When no ANTHROPIC_API_KEY is set, falls back to a solid, language-aware
 * template so the feature always produces a usable letter (never errors).
 */

import { APP_NAME, MODELS } from "@/lib/config";
import type { ScoredJob } from "@/lib/scrapers/types";
import { getAnthropic } from "./client";

const SYSTEM = `You write concise, sincere cover letters for an EARLY-CAREER / JUNIOR candidate.
Rules:
- 220–300 words, 3–4 short paragraphs, ready to send.
- Match the language of the job posting (French job -> French letter; English -> English; German -> German).
- Open with genuine, specific interest in THIS company/role (no generic filler).
- Lead with motivation, transferable skills, internships and studies — it is fine to be junior; show eagerness to learn and grow.
- Use concrete evidence from the CV that maps to the job's needs. Never overstate seniority or invent experience.
- Warm, confident, humble, professional. No clichés ("I am writing to apply"), no emojis, no markdown.
- End with a courteous call to action and the candidate's name.`;

function looksFrench(text: string): boolean {
  const t = text.toLowerCase();
  return /[àâçéèêëîïôûù]/.test(t) || /(cdd|cdi|expérience|événement|poste|entreprise|nous recherchons|stage)/.test(t);
}
function looksGerman(text: string): boolean {
  return /[äöüß]/.test(text) || /(gmbh|stelle|erfahrung|wir suchen|berlin)/i.test(text);
}

/** Template fallback used when no API key is configured. */
function templateCoverLetter(job: ScoredJob, name: string): string {
  const strengths = job.matchingSkills.slice(0, 4).join(", ") || "sales, events and marketing";
  if (looksFrench(job.description)) {
    return `Objet : Candidature au poste de ${job.title}

Madame, Monsieur,

Actuellement en fin d'études et en début de carrière, je souhaite rejoindre ${job.company} pour le poste de ${job.title}. Votre univers, à la croisée de l'hospitality, de l'événementiel et du lifestyle, correspond précisément au secteur dans lequel je veux évoluer.

Au cours de mes stages et expériences, j'ai développé des compétences directement utiles à ce poste : ${strengths}. J'aime le contact client, l'organisation d'événements et le travail en équipe, et je suis reconnu(e) pour ma rigueur, mon énergie et ma capacité à apprendre vite.

Bien que junior, je suis pleinement motivé(e) à m'investir, à monter en compétences rapidement et à contribuer concrètement à vos projets. Je serais ravi(e) d'échanger avec vous sur ma candidature lors d'un entretien.

Je vous remercie de l'attention portée à ma candidature et vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

${name}`;
  }
  if (looksGerman(job.description)) {
    return `Betreff: Bewerbung als ${job.title}

Sehr geehrte Damen und Herren,

als motivierte Nachwuchskraft am Anfang meiner Karriere bewerbe ich mich um die Stelle als ${job.title} bei ${job.company}. Der Bereich Hospitality, Events und Lifestyle ist genau das Umfeld, in dem ich mich weiterentwickeln möchte.

In Praktika und Studienprojekten konnte ich relevante Fähigkeiten aufbauen: ${strengths}. Ich arbeite gerne im Team, mag den Kontakt mit Kunden und lerne schnell.

Auch wenn ich noch am Anfang stehe, bin ich hoch motiviert, mich einzubringen und schnell dazuzulernen. Über ein persönliches Gespräch würde ich mich sehr freuen.

Mit freundlichen Grüßen,
${name}`;
  }
  return `Subject: Application for ${job.title}

Dear Hiring Team,

As an early-career candidate finishing my studies, I am excited to apply for the ${job.title} role at ${job.company}. Your world — at the intersection of hospitality, events and lifestyle — is exactly where I want to build my career.

Through my internships and studies I have developed skills that map directly to this role: ${strengths}. I genuinely enjoy client contact, organising events and working in a team, and I am known for being reliable, energetic and quick to learn.

While I am junior, I am fully committed to getting stuck in, growing fast and contributing real value to your projects. I would welcome the chance to discuss my application with you.

Thank you for considering my application.

Kind regards,
${name}`;
}

export async function generateCoverLetter(cv: string, job: ScoredJob): Promise<string> {
  const client = getAnthropic();
  if (!client) {
    // Graceful, always-works fallback (no API key configured).
    return templateCoverLetter(job, APP_NAME);
  }

  const msg = await client.messages.create({
    model: MODELS.writing,
    max_tokens: 900,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Candidate name: ${APP_NAME}

CANDIDATE CV:
${cv}

----

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description:
${job.description}

Match analysis — strengths to emphasise: ${job.matchingSkills.join(", ") || "n/a"}.
Gaps to address gracefully (don't dwell): ${job.missingSkills.join(", ") || "none"}.

Write the cover letter now as an early-career/junior candidate. Output ONLY the letter text.`,
      },
    ],
  });

  return msg.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("\n")
    .trim();
}
