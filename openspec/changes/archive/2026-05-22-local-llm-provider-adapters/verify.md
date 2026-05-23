# Verification: local-llm-provider-adapters

## Automated

- [ ] `npm run typecheck`
- [ ] `npm run test` (agent-adapters fixtures + daemon integration)

## Manual matrix

| Provider | Install | Detect (`GET /agents`) | Smoke (`POST /agents/smoke`) | Run (`POST /agents/runs`) |
|----------|---------|------------------------|------------------------------|---------------------------|
| Claude Code | `claude` on PATH | available + path | returns OK snippet | streams text events |
| Codex | `codex` on PATH | available | smoke OK | run completes |
| Cursor Agent | cursor CLI | available | smoke OK | run completes |
| Devin | `devin` + login | available after login | smoke OK | run completes |
| None installed | — | stubs false + setupMessage | N/A | error explains setup |

## Desktop

- [ ] Agents panel shows four providers with correct labels
- [ ] Test connection shows success/error banner
- [ ] Active adapter persists across restart (`activeAdapterId`)
