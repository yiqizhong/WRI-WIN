#!/usr/bin/env bash
# WRI-83 smoke helper — requires Vite on http://127.0.0.1:5173 and playwright-cli wrapper.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
VERIFY="$ROOT/openspec/changes/writer-carbon-ui-innovation/artifacts/verify"
PWCLI="${CODEX_HOME:-$HOME/.codex}/skills/playwright/scripts/playwright_cli.sh"

mkdir -p "$VERIFY"
cd "$ROOT"

if ! lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Start dev server first: npm run dev:desktop" >&2
  exit 1
fi

"$PWCLI" open http://127.0.0.1:5173/
"$PWCLI" resize 1440 900
sleep 2
"$PWCLI" screenshot
cp "$(ls -t .playwright-cli/page-*.png | head -1)" "$VERIFY/review-1440x900.png"
"$PWCLI" click e20
sleep 2
"$PWCLI" screenshot
cp "$(ls -t .playwright-cli/page-*.png | head -1)" "$VERIFY/agents-1440x900.png"
"$PWCLI" close

echo "Smoke screenshots written to $VERIFY"
