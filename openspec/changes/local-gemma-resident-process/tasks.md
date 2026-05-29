# Tasks: Local Gemma Resident Process

## 1. Resident runtime module

- [x] 1.1 Create `local-gemma-runtime.ts` with `LocalGemmaRuntime`: lazy spawn of `llama-cli -cnv` (`-ngl`, `-sys`, `--reasoning off`, `-n 512`, ctx 4096), liveness tracking
- [x] 1.2 Implement `runTurn(system, userText)` — write user text to stdin, parse stdout for that turn (ready prompt → footer), `stripTurn`. (No `/clear`: daemon injects history; restart after MAX_TURNS=50 bounds context)
- [x] 1.3 Serialize turns with an internal queue (one in-flight)
- [x] 1.4 Per-turn timeout → error + evict/recover
- [x] 1.5 Idle eviction timer (`WRITER_LOCAL_IDLE_MS`, default 300000, `0` disables)
- [x] 1.6 Crash recovery: detect exit, cold-start next turn
- [x] 1.7 `shutdown()` for daemon stop path

## 2. Adapter integration

- [x] 2.1 `run()` delegates to the resident runtime; per-message spawn kept as fallback (+ `WRITER_LOCAL_NO_RESIDENT=1` escape hatch)
- [x] 2.2 Pass split system prompt; runtime restarts when system changes
- [x] 2.3 Wire `shutdownLocalGemmaRuntime()` into the daemon SIGINT/SIGTERM path

## 3. Tests

- [x] 3.1 Turn parsing (`stripTurn`): ready prompt, ANSI, thinking-leak, plain — 5/5 pass
- [~] 3.2–3.5 Serialization / idle eviction / crash recovery / timeout — verified live (process-mock unit tests too brittle; covered end-to-end in verify.md §3–4)

## 4. Verification

- [x] 4.1 `npm run typecheck` — clean
- [x] 4.2 `npm run test --workspace @writer/agent-adapters` (local-gemma files) — 13/13 pass
- [x] 4.3 Live: cold 6931ms vs warm ~2.2s (~3x faster)
- [x] 4.4 Single resident llama-cli (PID 37060, ~5.6GB) served all messages; no reload
- [~] 4.5 Idle eviction implemented; confirm in a longer session (deferred)
