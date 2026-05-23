# Diagnosis · Paste Text send latency

## Root cause (WRI-90)

| Layer | Finding | Impact |
|-------|---------|--------|
| **Primary** | `POST /paste-text/conversations/:id/messages` **synchronously awaits** `startAgentRun` until CLI LLM finishes | 30–120s blocked HTTP; UI stuck on "Sending…" |
| **Not the issue** | LLM "connection" on first click | Adapter is already selected; delay is **inference**, not TCP/handshake |
| **Secondary** | `startAgentRun` called `getAgentAdapterList()` → detect **all** adapters each run | +1–5s CLI probe overhead per message |
| **UX** | User message hidden until full round-trip completes | Feels like Send never registered |

## Fix (WRI-91 / WRI-92)

1. **Async send API** — persist user + `pending` assistant message; return HTTP immediately; complete rewrite in background.
2. **Single-adapter resolve** — detect only the active/requested adapter per run.
3. **Optimistic UI** — show user + "Rewriting…" instantly; poll `GET /paste-text/conversations/:id` until `status: complete`.

## v2 — Streaming UI

1. **`launchAgentRun`** — register run and return immediately; consume adapter line stream in background.
2. **`agentRunId` on pending assistant** — links paste-text message to daemon run.
3. **Desktop polls `GET /agents/runs/:id`** every 500ms; accumulates `text` events for live output; refreshes conversation when run completes.

## Future (not this change)

- SSE/WebSocket push instead of polling
- Direct Anthropic API for copy-only rewrites
