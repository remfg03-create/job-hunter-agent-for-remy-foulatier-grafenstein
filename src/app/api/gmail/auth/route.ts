import { NextResponse } from "next/server";
import { gmailConfig, oauthClient, GMAIL_SCOPES } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/auth — start the one-time OAuth flow to mint a refresh token.
 * After consenting, /api/gmail/callback shows the token to paste into env.
 */
export async function GET() {
  const cfg = gmailConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first." },
      { status: 400 }
    );
  }
  const client = oauthClient(cfg);
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
  });
  return NextResponse.redirect(url);
}
