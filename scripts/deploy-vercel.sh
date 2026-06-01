#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy the Job Hunter Agent to Vercel (production).
#
# Usage:  bash scripts/deploy-vercel.sh
#
# - Installs the Vercel CLI if it's missing.
# - Logs you in (browser) on first run.
# - Links the project and deploys to production.
# Remember to add your environment variables in the Vercel dashboard afterwards
# (Project → Settings → Environment Variables) — see .env.example.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ Job Hunter Agent — Vercel deploy"

if ! command -v vercel >/dev/null 2>&1; then
  echo "• Vercel CLI not found — installing globally…"
  npm install -g vercel
fi

echo "• Vercel CLI: $(vercel --version)"
echo "• If this is your first deploy, a browser window will open to log in + link the project."

# Pull/ensure project is linked, then deploy to production.
vercel deploy --prod

echo ""
echo "✅ Deployed. Open the printed URL above."
echo "   Next steps:"
echo "   1. Add env vars in the Vercel dashboard (see .env.example)."
echo "   2. Set GitHub secrets VERCEL_APP_URL + CRON_SECRET for the 4×/day cron."
echo "   3. Paste the GitHub repo link + this Vercel URL into the Trello card (with your name)."
