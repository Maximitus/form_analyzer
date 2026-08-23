#!/usr/bin/env bash
# Publish Golf to production by whichever credential is available.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}" ]] || npx wrangler whoami >/dev/null 2>&1; then
  exec bash scripts/deploy-golf-to-cloudflare.sh
fi

if [[ -n "${GITHUB_TOKEN:-${GH_TOKEN:-}}" ]]; then
  exec bash scripts/push-golf-to-form-analyzer.sh
fi

echo "Need CLOUDFLARE_API_TOKEN, a Wrangler login, or GITHUB_TOKEN." >&2
exit 2
