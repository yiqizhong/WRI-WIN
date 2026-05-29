# Design: Local Gemma Resident Process

## Context

`local-gemma-adapter.run()` spawns a fresh `llama-cli` per message. The 8.6 GB
model reloads into VRAM each time (~4–5 s); inference is < 1 s. Reload is the
dominant cost. `llama-server.exe` (the natural persistent option) is not in the
bundle and GitHub is blocked on this network, so the fix must use the existing
`llama-cli.exe` binary.

Verified: a single `llama-cli -cnv` process (no `--single-turn`) answers multiple
prompts fed to stdin while keeping the model resident; the 2nd turn ran warm
(~70 tok/s, prompt processing ~515 tok/s) with no reload.

## Goals / Non-Goals

**Goals:**
- Keep the model resident in VRAM across messages.
- 2nd message onward: sub-second overhead.
- Transparent crash recovery and idle VRAM release.
- No new binary, no network dependency.

**Non-Goals:**
- HTTP/llama-server transport.
- Concurrent in-flight turns; multiple resident models.

## Decisions

### D1: Single global resident process, serialized turns
- One `llama-cli -cnv` process for the whole daemon (the model is identical for
  all sessions). Turns are queued and run one at a time.
- Rationale: VRAM holds one model copy; serializing avoids N reloads and OOM.
- Alternative: per-session process — rejected (would load the model many times).

### D2: Turn protocol over stdin/stdout
- Write the user text + newline to stdin to start a turn. The build echoes
  "> <user>" then streams the response, ending each turn with the per-turn footer
  "[ Prompt: ... t/s ]".
- Parse a turn as: text between the echoed user line and that footer. Reuse the
  existing `extractResponse` logic, scoped to a single turn's slice.
- The system prompt is set once at process start via `-sys`.

### D3: Idle eviction (default 5 min)
- A timer resets on each turn. On expiry, send `/exit` then kill; free VRAM.
- `WRITER_LOCAL_IDLE_MS` overrides; `0` disables eviction (always resident).

### D4: Crash recovery
- Track process liveness. If it exits unexpectedly, mark the runtime down; the
  next turn cold-starts a new process (accepting one reload).

### D5: Cancellation
- Prefer interrupting the current generation while keeping the process alive.
- If this build can't reliably interrupt mid-turn, fall back to kill+restart and
  accept a reload on the next message. Correctness over warm-cache on cancel.

### D6: Lifecycle ownership
- The runtime is created lazily on first run and torn down on daemon shutdown
  (hook into existing stop path) so no orphan GPU process remains.

## Risks / Trade-offs

[Risk] stdout turn boundaries are heuristic (footer marker). → Mitigation: the
footer is stable in this build; add a per-turn timeout so a missing footer can't
hang a request.

[Risk] A resident process pins ~6 GB VRAM. → Mitigation: idle eviction (D3).

[Risk] A wedged process blocks all sessions (global, serialized). → Mitigation:
per-turn timeout + crash recovery respawn; health check before reuse.

[Risk] Conversation mode accumulates context across turns (history grows). →
Mitigation: send `/clear` between unrelated turns, or restart at a context
threshold. V1: `/clear` before each turn so each rewrite is independent (the
daemon already injects conversation history into the prompt).

## Migration Plan

1. Add the resident runtime module with the turn protocol + lifecycle.
2. Switch `run()` to delegate to it; keep the cold-spawn path as a fallback when
   the runtime can't start.
3. Tests for turn parsing, serialization, idle eviction, crash recovery.
4. Verify end-to-end via the live daemon: measure 1st vs 2nd message latency.
5. Rollback: revert `run()` to per-message spawn; remove the runtime module.
