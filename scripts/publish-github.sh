#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Publish the Job Hunter Agent source to GitHub.
#
# Usage:  bash scripts/publish-github.sh
#
# - Installs the GitHub CLI (gh) if missing.
# - Creates a public repo named job-hunter-agent-for-remy-foulatier-grafenstein
#   under your account and pushes the code.
# Safe to re-run: if the repo already exists it just pushes the latest commits.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

REPO_NAME="job-hunter-agent-for-remy-foulatier-grafenstein"

echo "▶ Publishing $REPO_NAME to GitHub"

if ! command -v gh >/dev/null 2>&1; then
  echo "• GitHub CLI (gh) not found."
  if [[ "$OSTYPE" == "darwin"* ]] && command -v brew >/dev/null 2>&1; then
    echo "  Installing via Homebrew…"
    brew install gh
  else
    echo "  Please install it: https://cli.github.com/  then re-run this script."
    exit 1
  fi
fi

# Ensure authenticated.
if ! gh auth status >/dev/null 2>&1; then
  echo "• Logging in to GitHub…"
  gh auth login
fi

# Initialise git if needed.
if [ ! -d .git ]; then
  git init -b main
  git add -A
  git commit -m "Initial commit: Job Hunter Agent"
fi

# Create the repo (or reuse it) and push.
if gh repo view "$REPO_NAME" >/dev/null 2>&1; then
  echo "• Repo already exists — pushing latest commits."
  git remote get-url origin >/dev/null 2>&1 || \
    git remote add origin "https://github.com/$(gh api user -q .login)/$REPO_NAME.git"
  git push -u origin main
else
  echo "• Creating public repo and pushing…"
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push \
    --description "AI job-hunting agent: scans 5 job boards 4×/day, scores matches 1–10 vs your CV, drafts cover letters & Gmail applications."
fi

echo ""
echo "✅ Published: https://github.com/$(gh api user -q .login)/$REPO_NAME"
echo "   Next: bash scripts/deploy-vercel.sh   (deploy live), then submit both links to Trello."
