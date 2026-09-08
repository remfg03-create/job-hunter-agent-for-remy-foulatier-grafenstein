/**
 * Gmail integration (drafts only).
 *
 * Creates a Gmail DRAFT — never auto-sends — with the cover letter as the email
 * body and the cover letter + CV attached as files. The user reviews and clicks
 * send inside Gmail. Auth is OAuth2 with a long-lived refresh token stored in
 * the environment (mint it once via /api/gmail/auth).
 */

import { google } from "googleapis";

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
  user?: string;
}

export function gmailConfig(): GmailConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/gmail/callback",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    user: process.env.GMAIL_USER,
  };
}

export function oauthClient(cfg: GmailConfig) {
  const client = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
  if (cfg.refreshToken) client.setCredentials({ refresh_token: cfg.refreshToken });
  return client;
}

/** Scope needed to create drafts. */
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.compose"];

export interface Attachment {
  filename: string;
  content: string; // utf-8 text content
  mimeType?: string;
}

/** Build a base64url-encoded RFC 2822 MIME message with attachments. */
function buildMime(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments: Attachment[];
}): string {
  const boundary = "jha_boundary_part";
  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${mimeEncodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    opts.body,
    "",
  ];

  for (const att of opts.attachments) {
    const b64 = Buffer.from(att.content, "utf-8").toString("base64");
    lines.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType || "text/plain"}; charset=UTF-8; name="${att.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${att.filename}"`,
      "",
      b64,
      ""
    );
  }
  lines.push(`--${boundary}--`, "");

  return Buffer.from(lines.join("\r\n"), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function mimeEncodeHeader(value: string): string {
  // Encode non-ASCII subject lines per RFC 2047.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

/** Create a Gmail draft. Returns the draft id + a link to open it. */
export async function createDraft(opts: {
  to: string;
  subject: string;
  body: string;
  attachments: Attachment[];
}): Promise<{ draftId: string; link: string }> {
  const cfg = gmailConfig();
  if (!cfg) throw new Error("Gmail is not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  if (!cfg.refreshToken) {
    throw new Error("No GOOGLE_REFRESH_TOKEN — visit /api/gmail/auth once to authorise Gmail.");
  }

  const auth = oauthClient(cfg);
  const gmail = google.gmail({ version: "v1", auth });
  const from = cfg.user || "me";

  const raw = buildMime({ ...opts, from, to: opts.to || from });
  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });

  const draftId = res.data.id || "";
  return { draftId, link: "https://mail.google.com/mail/u/0/#drafts" };
}

/**
 * Envoie un message HTML (sans pièce jointe).
 *
 * Utilisé par le veilleur : un brouillon ne constitue pas une alerte, puisqu'il
 * faudrait aller le consulter pour apprendre qu'une offre est parue. La portée
 * `gmail.compose` déjà demandée couvre l'envoi, donc aucune ré-autorisation
 * n'est nécessaire.
 */
export async function sendHtmlMessage(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string }> {
  const cfg = gmailConfig();
  if (!cfg) throw new Error("Gmail is not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  if (!cfg.refreshToken) {
    throw new Error("No GOOGLE_REFRESH_TOKEN — visit /api/gmail/auth once to authorise Gmail.");
  }

  const auth = oauthClient(cfg);
  const gmail = google.gmail({ version: "v1", auth });
  const from = cfg.user || "me";

  const lines = [
    `From: ${from}`,
    `To: ${opts.to || from}`,
    `Subject: ${mimeEncodeHeader(opts.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    opts.html,
  ];
  const raw = Buffer.from(lines.join("\r\n"), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return { messageId: res.data.id || "" };
}
