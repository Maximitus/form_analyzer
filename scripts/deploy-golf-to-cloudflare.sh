#!/usr/bin/env bash
# Deploy this snapshot to the Cloudflare Worker that serves
# https://maxmvs.com/formanalyzer/ (form-analyzer.maxwellscottnelson.workers.dev).
set -euo pipefail

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -z "${CF_API_TOKEN:-}" ]]; then
  echo "Missing CLOUDFLARE_API_TOKEN with Workers/Pages deploy rights for project form-analyzer." >&2
  exit 2
fi

export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN}}"
cd "$(dirname "$0")/.."
npm run build
npx wrangler deploy
echo "Deployed Cloudflare Worker form-analyzer."
