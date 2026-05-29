# Plan: Local Gemma Resident Process

> Manual plan (superpowers:writing-plans unavailable this session).

**Goal:** Keep the model resident across messages so the 2nd message onward has
sub-second overhead, using the existing `llama-cli.exe` (no new binary, no
network). Verify end-to-end through the live daemon.

---

## Task 1: Resident runtime module

**File:** `packages/agent-adapters/src/adapters/local-gemma-runtime.ts` (new)

### Step 1.1 — Singleton skeleton
Export `class LocalGemmaRuntime` with private `child`, `busy`, `queue`,
`idleTimer`, `currentSystem`. Constructor takes `{ binary, modelPath, gpuLayers }`.

### Step 1.2 — ensureProcess(system)
If `child` is dead or `currentSystem !== system`, kill any existing and spawn:
`llama-cli --model <m> --ctx-size 4096 -ngl <n> -cnv --simple-io --reasoning off
-n 512 -sys <system>` with `cwd: dirname(binary)`. Attach exit handler to null
out `child`. Wait for the first `> ` ready prompt on stdout before returning.

### Step 1.3 — runTurn(userText)
Acquire the serialize lock (queue if busy). Write `userText + "\n"` to stdin.
Accumulate stdout until the per-turn footer `[ Prompt:` appears. Slice that turn's
output and run `extractResponse(slice, userText)`. Reset idle timer. Release lock.

### Step 1.4 — Per-turn timeout
Race the footer-wait against `WRITER_LOCAL_TURN_TIMEOUT_MS` (default 120000).
On timeout: emit error, kill+respawn (treat as crash).

### Step 1.5 — Idle eviction
After each turn, set a timer for `WRITER_LOCAL_IDLE_MS` (default 300000). On fire:
write `/exit`, kill, null `child`. `0` disables.

### Step 1.6 — shutdown()
Kill child, clear timers. Call from daemon stop.

Commit: `agent-adapters: add LocalGemmaRuntime resident process manager`

---

## Task 2: Adapter integration

**File:** `local-gemma-adapter.ts`

### Step 2.1 — Use the runtime in run()
Replace the per-message spawn with `runtime.runTurn(user)`. Keep the old
spawn-based path behind a `WRITER_LOCAL_NO_RESIDENT=1` escape hatch / fallback if
`ensureProcess` throws.

### Step 2.2 — System prompt handling
Pass `system` from `splitCopywriterPrompt`. If it differs from the resident
process's current system, the runtime restarts (Step 1.2 handles it).

### Step 2.3 — Daemon shutdown wiring
Export a `shutdownLocalGemmaRuntime()` and call it from the daemon stop path
(where `stopManagedDaemon` / process teardown lives).

Commit: `agent-adapters: route local-gemma runs through resident runtime`

---

## Task 3: Tests

Mock `child_process.spawn` with a fake duplex; assert turn parsing,
serialization order, idle eviction (fake timers), crash respawn, turn timeout.

Commit: `agent-adapters: tests for resident runtime`

---

## Task 4: Live verification

- `npm run typecheck` && `npm run test --workspace @writer/agent-adapters`
- Start the daemon; send message #1 (cold) and #2 (warm) via the paste-text API;
  record both latencies. Expect #2 overhead < 1 s.
- Watch `nvidia-smi` / daemon log to confirm no reload between messages.
- Wait out the idle timeout; confirm VRAM frees.
