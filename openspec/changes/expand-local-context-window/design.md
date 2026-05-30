# Design — expand-local-context-window

## Context

- Current cap: `--ctx-size 4096` hardcoded in two spawn paths
  (`local-gemma-runtime.ts:101` resident; `local-gemma-adapter.ts` cold-spawn).
- Manifest already declares `defaultContext: 8192`, `modelMaxContext: 131072`
  (`apps/daemon/src/local-model-manifest.ts`) — the runtime ignores it.
- History is re-injected per turn and trimmed by count only
  (`HISTORY_LIMIT = 6` in `packages/review-core/src/copywriter-skill.ts`).
- Hardware target: 12 GB VRAM (RTX PRO 3000 Blackwell). Q8 model ≈ 8.6 GB →
  ~3 GB headroom for KV + compute. VRAM is the binding constraint.

## Goals

1. Usable 16K context window, sourced from the manifest, env-overridable.
2. Prompt always fits the window (token-aware trimming) — no hard failure on length.
3. New chat = genuine zero context at the model level.
4. Preserve ~50 tok/s: FP16 KV when it fits, q8 only as a VRAM fallback.

## Layer boundaries (respected)

- `packages/review-core` (pure prompt shaping): owns token-budget trimming. No
  process or VRAM knowledge. Fully unit-testable as a pure function.
- `packages/agent-adapters` (process/runtime): owns ctx-size selection, KV
  precision + fallback, and session-change reset.
- `apps/daemon` (manifest/config): owns the `defaultContext` value as the single
  source of truth.
- No renderer changes: the "New Chat" button and `POST /paste-text/conversations`
  endpoint already exist; this change only makes the model side honor the reset.

## Decisions

### 1. Context size from manifest + env

- Bump `defaultContext: 8192 → 16384` in the manifest.
- The runtime resolves ctx-size as: `WRITER_LOCAL_CTX_SIZE` env (if a finite
  positive integer) → manifest `defaultContext` → hard default 16384.
- Both spawn paths pass the resolved value to `--ctx-size`.
- The resolved value is also the input to the trim budget (below), so the two can
  never disagree.

### 2. KV precision with FP16→q8 fallback

- Resolve precision: `WRITER_LOCAL_KV_TYPE` env (`f16` | `q8_0` | `q4_0`) if set,
  else start at `f16`.
- Spawn with `--cache-type-k <type> --cache-type-v <type>` (omit the flags
  entirely when `f16` to match llama.cpp's default and keep current behavior
  byte-identical in the common path).
- Fallback: if the process fails to reach the ready prompt and stderr indicates a
  VRAM/allocation failure, re-spawn once with `q8_0` and cache that precision for
  the lifetime of the runtime so subsequent (re)starts skip the failed FP16 try.
- An explicit `WRITER_LOCAL_KV_TYPE` disables the automatic fallback (user is
  benchmarking a specific precision).

### 3. Token-aware history trimming

- New pure helper in `review-core`, e.g. `trimHistoryToBudget(history, budget)`:
  - Estimate tokens with a conservative `ceil(chars / 4)` heuristic (no tokenizer
    dependency; biased to over-count so we under-fill rather than overflow).
  - Reserve: output (`-n` = 512) + estimated system/fixed-context tokens +
    a safety margin (e.g. 256).
  - Walk history newest → oldest, accumulate, stop when the next message would
    exceed the budget. Always retain the current `userText`.
  - Keep `HISTORY_LIMIT` as a secondary upper bound.
- `buildCopywriterPrompt` replaces `slice(-HISTORY_LIMIT)` with this call. Trimming
  is silent (no overflow marker), per the product decision.
- Budget is derived from the same ctx-size the runtime uses, passed via
  `CopywriterSkillInput` (or a module constant kept in sync with the manifest).

### 4. New-chat zero-context reset

- Thread the conversation's `sessionId` (already on `AgentRunRequest`) into
  `LocalGemmaRuntime.runTurn(system, user, sessionId)`.
- The runtime tracks `currentSessionId`. `ensureProcess` reuses the resident
  process only when `resident && currentSystem === system &&
  currentSessionId === sessionId && turnsHandled < MAX_TURNS`.
- A session change takes the existing evict → respawn path (same mechanism as a
  system-prompt change), guaranteeing the new chat's KV cache is empty.
- Faster `/clear`-without-restart is noted as a future optimization but not relied
  on here (its semantics in this llama.cpp build are unverified).

## Risks / trade-offs

- **q8 KV speed cost** (~few % on CUDA): only when FP16 16K does not fit; surfaced
  via the precision override for benchmarking.
- **`chars/4` token estimate is approximate**: deliberately conservative; worst
  case we trim slightly more history than strictly necessary, never overflow.
- **Reload on chat switch** (~4–5 s): acceptable for an infrequent action; no
  effect on steady-state generation.
- **Manifest 131072 vs realistic ~32K**: we target 16K, well inside both, so the
  inflated `modelMaxContext` is not load-bearing here.

## Verification

- `npm run typecheck`, `npm run test`.
- `openspec validate expand-local-context-window --type change --strict`.
- Manual: long chat no longer errors at the old 4096 boundary; new chat does not
  echo prior-chat context; observe tok/s stays ~50 with FP16 KV at 16K.
