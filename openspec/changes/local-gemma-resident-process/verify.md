# Verify: Local Gemma Resident Process

## Implementation evidence

- New module `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`
  (`LocalGemmaRuntime`): lazy spawn, serialized turns, idle eviction, crash
  recovery, per-turn timeout, context-bounded restart.
- `local-gemma-adapter.ts` `run()` delegates to the resident runtime via
  `tryRunResident`, with a cold-spawn fallback and a `WRITER_LOCAL_NO_RESIDENT=1`
  escape hatch.
- Daemon `index.ts` calls `shutdownLocalGemmaRuntime()` on SIGINT/SIGTERM.

## Checks

1. **Typecheck**: `npm run typecheck` — all workspaces pass (clean).
2. **Unit tests**: `stripTurn` parsing — 5/5 pass. (Stateful lifecycle verified
   live below; faithful stdin/stdout process mocking proved too brittle for unit
   tests, so it is covered end-to-end instead.)
3. **Live latency (cold vs warm)** through the paste-text daemon API:

   | Message | Latency | Output |
   |---------|---------|--------|
   | MSG1 (cold) | 6931 ms | "Submit the form and we'll be in touch shortly." |
   | MSG2 (warm) | 2239 ms | "Your password expires in three days." |
   | MSG3 (warm) | 2275 ms | "Delete your account permanently and lose all data." |

   Warm messages ~3x faster than cold — the model is not reloaded.

4. **GPU residency**: a single `llama-cli.exe` (PID 37060, ~5.6 GB) served all
   three messages and appeared as an active CUDA compute process in
   `nvidia-smi`. Zero "Loading model" reloads across messages 2–3.

## Deferred / follow-up

- Idle eviction (`WRITER_LOCAL_IDLE_MS`, default 5 min) and the context-bounded
  restart (MAX_TURNS=50) are implemented but not exercised in this live run —
  covered by design, to confirm in a longer session.
- Cancellation currently resolves as a no-op for resident turns (the turn runs
  to completion). Mid-turn interrupt is a future refinement.

## Overall Decision

- [x] ⚠️ PASS WITH WARNINGS

Warnings: stateful lifecycle relies on live verification rather than unit tests;
idle eviction and cancellation refinements deferred.
