## Why

Local Gemma chats hit a token limit after a handful of messages (or when the app
reopens a long conversation): inference truncates or fails. The cause is a
hardcoded `--ctx-size 4096` in the runtime — smaller than the model manifest's own
`defaultContext: 8192` — combined with history trimming that is capped by message
count, not tokens. The fixed guideline/brand-voice context plus a few long turns
plus the 512-token reply overflow 4096 well within the 6-message cap.

Designers and content designers running the local-first workflow need to hold a
real working conversation without the model silently losing context or erroring.
This change raises the usable window to a hardware-safe ceiling, makes trimming
token-aware so the prompt always fits, and guarantees that starting a new chat
truly resets the model's context.

## What Changes

**Local inference context window**
- From: The Local Gemma runtime spawns `llama-cli` with a hardcoded `--ctx-size 4096`, ignoring the manifest's declared context.
- To: The runtime sources the context size from the model manifest (`defaultContext`, raised to 16384) and accepts a `WRITER_LOCAL_CTX_SIZE` override. Both spawn paths (resident process and cold-spawn fallback) use it.
- Reason: 4096 is below the manifest default and too small for multi-turn UX-copy work on the supported 12 GB GPU.
- Impact: Non-breaking. Larger window fits in VRAM via FP16 KV (with a q8 fallback).

**KV cache precision with VRAM fallback**
- From: KV cache precision is implicit (FP16) and the larger window is untested against VRAM.
- To: The runtime spawns with FP16 KV first and, if the model fails to load for lack of VRAM, transparently retries with q8_0 KV and remembers that choice. A `WRITER_LOCAL_KV_TYPE` override forces a precision for benchmarking.
- Reason: FP16 preserves full generation speed when 16K fits; q8 guarantees the window still loads on tighter VRAM.
- Impact: No per-token cost in the common case; a few-percent cost only when fallback engages.

**Token-aware history trimming**
- From: `buildCopywriterPrompt` keeps the last N messages by count (`HISTORY_LIMIT = 6`), so long messages can still overflow the window.
- To: History is trimmed by a token budget derived from the context size (sliding window, newest kept, current message always kept); the message count remains a secondary upper bound.
- Reason: A count cap does not bound tokens; only a token budget keeps the prompt under the hard ceiling.
- Impact: Chats never hard-fail on length; the model silently forgets the oldest turns once the budget is exhausted.

**New-chat zero-context reset**
- From: The single shared resident process resets only on system-prompt change or after 50 turns, so a new chat can inherit the prior chat's KV cache.
- To: A change of conversation/session forces a clean runtime restart, so a new chat starts at genuine zero context at the model level.
- Reason: "New chat" must mean a fresh model state, not just empty injected history.
- Impact: A one-time model reload (~4–5 s) when switching chats; no steady-state throughput change.

## Capabilities

### Modified Capabilities

- `agent-adapter-runtime`: the Local Gemma runtime sizes its context window from the model manifest, negotiates KV-cache precision against available VRAM, and resets model context when the active conversation changes.
- `paste-text-chat`: prompt assembly trims conversation history by token budget rather than message count.

## Impact

- `apps/daemon/src/local-model-manifest.ts`: raise `defaultContext` to 16384.
- `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`: read ctx-size from manifest/env, add KV precision + FP16→q8 fallback, reset on session change, thread `sessionId` into `runTurn`.
- `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`: pass ctx-size/KV flags to the cold-spawn fallback; thread `sessionId`.
- `packages/review-core/src/copywriter-skill.ts`: replace count-only history slice with token-budget trimming.

Non-goals: full 32K/128K context productization, an in-app GPU/context tuning UI, multiple concurrent local models, streaming token output, and persisting summarized history across trims.
