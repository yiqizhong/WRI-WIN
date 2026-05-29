# Proposal: Local Gemma Resident Process

## Why

Local Gemma reloads the 8.6 GB model into VRAM on every message (~4–5 s) because
the adapter spawns a fresh `llama-cli` per request. Actual inference is < 1 s. The
reload dominates latency and makes the feature feel slow.

A persistent `llama-server` would solve it, but its binary isn't bundled and
GitHub downloads are blocked on this network. Instead, keep one `llama-cli`
process resident in conversation mode and route each turn to its stdin — verified
to keep the model warm (2nd turn ran with no reload, ~70 tok/s).

## What Changes

1. Introduce a **resident local runtime**: a single long-lived `llama-cli -cnv`
   process owning the model in VRAM.
2. Route each agent run as a **turn** written to the resident process's stdin;
   parse that turn's response from the continuous stdout stream.
3. **Serialize** turns (one in-flight at a time; single GPU/context).
4. **Idle eviction**: shut the process down after an idle timeout to free VRAM.
5. **Crash recovery**: respawn transparently on next request if the process died.
6. Preserve cancellation semantics without forcing a model reload where possible.

## Capabilities

### New Capabilities
- `local-gemma-resident-runtime` — a process manager that keeps llama-cli resident,
  serializes turns, evicts on idle, and recovers from crashes.

### Modified Capabilities
- `local-gemma-adapter` — `run()` delegates to the resident runtime instead of
  spawning a per-message process.

## Impact

- `packages/agent-adapters/src/adapters/local-gemma-runtime.ts` — new resident runtime.
- `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` — use the runtime.
- Tests: turn parsing, serialization, idle eviction, crash recovery.

## Non-Goals

- llama-server / HTTP transport (binary unavailable, network blocked).
- Multiple concurrent in-flight turns.
- Multiple resident models.
- Cross-process model sharing beyond the daemon.
