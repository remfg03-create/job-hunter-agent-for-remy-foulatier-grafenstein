/**
 * Envoi des alertes par SMTP Gmail, avec un mot de passe d'application.
 *
 * Remplace le parcours OAuth de src/lib/gmail.ts, abandonné le 2026-09-15 après
 * trois échecs successifs côté Google (403 utilisateur non testeur, 500 sur
 * l'écran de consentement, 400 sur la redirection). Le mot de passe
 * d'application supprime l'écran de consentement, l'application à publier et
 * surtout l'expiration du jeton à sept jours qui aurait interrompu les alertes
 * sans prévenir.
 *
 * Le mot de passe vit dans .env.local en local et dans les secrets GitHub en
 * production. Jamais dans le dépôt.
 */

import nodemailer from "nodemailer";

export interface MailerConfig {
  /** Adresse expéditrice, celle qui détient le mot de passe d'application. */
  user: string;
  /** Mot de passe d'application à 16 caractères. Les espaces sont ignorés. */
  appPassword: string;
  to: string;
}

export function mailerConfig(): MailerConfig | null {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.ALERT_EMAIL_TO || user;
  if (!user || !appPassword || !to) return null;
  return { user, appPassword: appPassword.replace(/\s+/g, ""), to };
}

export async function sendAlert(
  cfg: MailerConfig,
  subject: string,
  html: string
): Promise<string> {
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: cfg.user, pass: cfg.appPassword },
  });

  const info = await transport.sendMail({
    from: `"Veille emploi Melbourne" <${cfg.user}>`,
    to: cfg.to,
    subject,
    html,
  });
  return info.messageId;
}
