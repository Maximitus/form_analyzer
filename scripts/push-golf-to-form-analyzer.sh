#!/usr/bin/env bash
# Copy this Form Analyzer snapshot (Golf + RTMPose) onto
# Maximitus/Form-Analyzer main so Cloudflare can deploy maxmvs.com/formanalyzer/.
set -euo pipefail

TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [[ -z "${TOKEN}" ]]; then
  echo "Missing GITHUB_TOKEN (or GH_TOKEN) with contents:write on Maximitus/Form-Analyzer." >&2
  exit 2
fi

SRC="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

REMOTE="https://x-access-token:${TOKEN}@github.com/Maximitus/Form-Analyzer.git"
git clone --depth 1 "${REMOTE}" "${TMP}/fa"

# Overlay the production snapshot without git metadata or local build artifacts.
tar -C "${SRC}" \
  --exclude .git \
  --exclude node_modules \
  --exclude dist \
  --exclude 'public/ort/*.wasm' \
  --exclude 'public/ort/*.mjs' \
  --exclude 'public/models/*.onnx' \
  -cf - . | tar -C "${TMP}/fa" -xf -

cd "${TMP}/fa"
git add -A
if git diff --cached --quiet; then
  echo "Form-Analyzer main already matches this snapshot."
  exit 0
fi

git -c user.name='Maxwell Nelson' \
    -c user.email='maxwellscottnelson@gmail.com' \
    commit -m "Add Golf mode and replace BlazePose with RTMPose"

git push origin HEAD:main
echo "Pushed to Maximitus/Form-Analyzer main."
