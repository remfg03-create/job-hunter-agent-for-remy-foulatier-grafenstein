import { NextRequest, NextResponse } from "next/server";
import { gmailConfig, oauthClient } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/callback?code=... — exchange the OAuth code for tokens and
 * display the refresh token to copy into GOOGLE_REFRESH_TOKEN.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const cfg = gmailConfig();
  if (!cfg) return NextResponse.json({ error: "Gmail not configured." }, { status: 400 });
  if (!code) return NextResponse.json({ error: "Missing ?code." }, { status: 400 });

  try {
    const client = oauthClient(cfg);
    const { tokens } = await client.getToken(code);
    const refresh = tokens.refresh_token;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Gmail connected</title>
    <style>body{font-family:ui-sans-serif,system-ui;background:#0b1020;color:#e6e9f5;padding:48px;line-height:1.6}
    code{background:#1a2138;padding:14px;border-radius:10px;display:block;word-break:break-all;margin:12px 0;color:#8be9c0}
    a{color:#7aa2ff}</style></head><body>
    <h1>✅ Gmail authorised</h1>
    ${refresh
      ? `<p>Add this to your <code>.env.local</code> (and Vercel env vars):</p>
         <p><b>GOOGLE_REFRESH_TOKEN=</b></p><code>${refresh}</code>
         <p>Then restart the app. The agent can now create Gmail drafts.</p>`
      : `<p>No refresh token returned — revoke access at <a href="https://myaccount.google.com/permissions">Google permissions</a> and try <a href="/api/gmail/auth">/api/gmail/auth</a> again (it forces consent).</p>`}
    <p><a href="/">← Back to the dashboard</a></p>
    </body></html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
