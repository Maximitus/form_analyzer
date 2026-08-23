#!/usr/bin/env bash
# Deploy this snapshot to the Cloudflare Worker that serves
# https://maxmvs.com/formanalyzer/ (form-analyzer.maxwellscottnelson.workers.dev).
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "${CLOUDFLARE_API_TOKEN:-}" || -n "${CF_API_TOKEN:-}" ]]; then
  export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN}}"
elif npx wrangler whoami >/tmp/wrangler-whoami.txt 2>&1; then
  echo "Using existing Wrangler login:"
  cat /tmp/wrangler-whoami.txt
else
  echo "Not logged into Wrangler. Set CLOUDFLARE_API_TOKEN or run: npx wrangler login --device" >&2
  echo "whoami:" >&2
  cat /tmp/wrangler-whoami.txt >&2 || true
  exit 2
fi

npm run build
npx wrangler deploy
echo "Deployed Cloudflare Worker form-analyzer."
