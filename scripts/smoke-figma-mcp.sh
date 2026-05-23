#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${WRITER_DAEMON_URL:-http://127.0.0.1:47631}"

echo "Figma MCP read smoke:"
curl -fsS "${BASE_URL}/mcp/smoke/figma/read" | jq .

if [[ -z "${FIGMA_ACCESS_TOKEN:-}" ]]; then
  echo "FIGMA_ACCESS_TOKEN not set — skipping write smoke (dry-run only)."
  exit 0
fi

echo "Figma MCP write smoke (requires approved changeId in body):"
curl -fsS -X POST "${BASE_URL}/mcp/smoke/figma/write" \
  -H 'content-type: application/json' \
  -d '{"sessionId":"manual-smoke","changeId":"replace-me"}' | jq .
