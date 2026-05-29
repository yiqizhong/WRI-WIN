Manual brainstorm capture for `local-gemma-resident-process`

Note: `superpowers:brainstorming` was not available this session. Manual capture
authorized by the user after PRECHECK.

## Background

The Local Gemma adapter spawns a fresh `llama-cli` process for every message.
Each spawn reloads the 8.6 GB Q8_0 model from disk into VRAM (~4–5 s). Actual
compute (prompt processing + generation of a short UX rewrite) is < 1 s. So the
dominant per-message latency is model reload, not inference.

Measured (RTX PRO 3000, b9384 CUDA build):
- Generation ~50 tok/s; prompt processing ~265 tok/s cold, ~515 tok/s warm.
- A 2nd prompt sent to an already-resident process ran at 71 tok/s with no reload.

The user's goal: make the 2nd message onward fast (<1 s of overhead).

## Why not llama-server

The obvious "persistent server" answer is `llama-server.exe` over HTTP. But:
- `llama-server.exe` is NOT in the `~/.writer/` bundle (only `llama-server-impl.dll`).
- GitHub release downloads are blocked on this network (corporate proxy); only
  HuggingFace and developer.download.nvidia.com are reachable. So we cannot fetch
  the matching b9384 `llama-server.exe` here.

## Decision direction

Keep ONE long-lived `llama-cli` process in conversation mode (`-cnv`, no
`--single-turn`) per session and feed each new user turn to its stdin. The model
stays resident in VRAM across turns. Verified working: two prompts answered by a
single resident process, 2nd one faster (warm).

### Open questions / forks

Q1: Process scope — one resident process per session, or one global shared
    process? → Per session is simpler and matches how conversations map to
    sessions; but VRAM holds one model, so a global single process (serialized
    turns) avoids loading the model N times. DECISION: single global resident
    process, serialize turns through it. The model is the same for all sessions.

Q2: Turn boundary parsing — stdout is now a continuous stream across turns. Each
    turn ends with the per-turn footer "[ Prompt: ... t/s ]". DECISION: treat the
    footer as the turn-complete delimiter; everything between the echoed user
    line and the footer is that turn's response (reuse extractResponse logic
    per-turn).

Q3: Idle eviction — a resident model pins ~6 GB VRAM. DECISION: evict after an
    idle timeout (default 5 min, WRITER_LOCAL_IDLE_MS override) by sending /exit
    and killing the process; next message cold-starts it again.

Q4: Cancellation — cancelling a turn must not kill the resident process (would
    force a reload). DECISION: on cancel, send an interrupt to stop the current
    generation but keep the process alive; if that's not reliable in this build,
    fall back to kill + restart (accept the reload on the next message).

Q5: Crash recovery — if the resident process dies, the next message must
    transparently respawn it. DECISION: detect process exit, mark runtime as
    down, cold-start on next request.

Q6: Concurrency — two messages arriving while a turn is in flight. DECISION:
    queue turns; one in-flight at a time (single GPU, single context).
