# Tasks: Local Gemma Resident Process

## 1. Resident runtime module

- [ ] 1.1 Create `packages/agent-adapters/src/adapters/local-gemma-runtime.ts` with a `LocalGemmaRuntime` singleton: lazy spawn of `llama-cli -cnv` (with `-ngl`, `-sys`, `--reasoning off`, `-n`, ctx 4096), liveness tracking
- [ ] 1.2 Implement `runTurn(userText): AsyncGenerator<event>` — write `/clear` + user text to stdin, parse stdout for that turn (echo line → footer), reuse `extractResponse`
- [ ] 1.3 Serialize turns with an internal queue (one in-flight)
- [ ] 1.4 Per-turn timeout → error event + recover
- [ ] 1.5 Idle eviction timer (`WRITER_LOCAL_IDLE_MS`, default 300000, `0` disables)
- [ ] 1.6 Crash recovery: detect exit, cold-start next turn
- [ ] 1.7 `shutdown()` for daemon stop path

## 2. Adapter integration

- [ ] 2.1 `run()` delegates to the resident runtime; keep per-message spawn as fallback if the runtime fails to start
- [ ] 2.2 Pass the split system prompt to the runtime (set once at process start; if system changes between runs, restart the process)
- [ ] 2.3 Wire `shutdown()` into the daemon stop path

## 3. Tests

- [ ] 3.1 Turn parsing: a turn slice → clean answer (mock stdout)
- [ ] 3.2 Serialization: two runs complete in order, one at a time
- [ ] 3.3 Idle eviction: process terminated after timeout (fake timers)
- [ ] 3.4 Crash recovery: respawn after simulated exit
- [ ] 3.5 Per-turn timeout: error event emitted

## 4. Verification

- [ ] 4.1 `npm run typecheck`
- [ ] 4.2 `npm run test --workspace @writer/agent-adapters`
- [ ] 4.3 Live daemon: measure 1st vs 2nd message latency; 2nd should be sub-second overhead
- [ ] 4.4 Confirm GPU stays resident between messages (VRAM held, no reload in logs)
- [ ] 4.5 Confirm idle eviction frees VRAM after timeout
