# Design — tune-local-inference-speed

## Context

- Model: Gemma 4 E4B **Q8_0** (~8.6 GB). Runtime: bundled `llama-cli` b9384 on
  CUDA 12.8, `-ngl 99`. Decode ~50 tok/s, prefill ~200 tok/s.
- Decode is memory-bandwidth-bound. GPU bandwidth 672 GB/s → Q8 ceiling
  `672 ÷ 8.6 ≈ 78 tok/s` (~58–66 realistic). User at 50 ≈ 75% of realistic.
- `-fa` defaults to `auto` (likely already enabling FA on CUDA for Gemma). `-ub`
  is the default 512. Neither is set explicitly today.

## Goals (no quality loss)

1. Deterministically enable flash attention.
2. Raise prompt-processing throughput (the ~200 tok/s "reading" speed) via batch.
3. Measure per-turn throughput so gains are verifiable and a later
   speculative-decoding decision is evidence-based.

## Non-goals

Quantization change, speculative decoding, custom llama.cpp rebuild, multi-GPU,
streaming output, desktop perf UI. ~100 tok/s is explicitly out of reach on Q8 by
tuning alone and is not promised here.

## Layer boundaries

All changes live in `packages/agent-adapters` (runtime spawn path). This change
**extends `buildSpawnArgs`** introduced by `expand-local-context-window`; land that
first. No daemon/desktop/contracts changes. Tuning is env-overridable, matching the
existing `WRITER_LOCAL_*` convention.

## Decisions

### 1. Explicit flash attention

- Resolve from `WRITER_LOCAL_FLASH_ATTN` (`on` | `off` | `auto`), default `on`.
- `buildSpawnArgs` appends `-fa <value>`.
- Rationale: deterministic vs the build's `auto` heuristic; FA reduces KV
  bandwidth, aiding prefill and longer-context turns. No effect on output text.

### 2. Prefill batch size

- Resolve from `WRITER_LOCAL_UBATCH`, default **1024** (up from llama-cli's 512).
- `buildSpawnArgs` appends `-ub <value>`. Leave `-b` (logical batch) at its 2048
  default.
- Bound to 1024 (not 2048) so transient prefill buffers fit in 12 GB alongside the
  8.6 GB model and the 16K-context KV from `expand-local-context-window`. If a
  larger value is forced via env and the model fails to load, the FP16→q8 KV
  fallback path from the dependency change still applies; ubatch itself is not part
  of that fallback, so document that an over-large `WRITER_LOCAL_UBATCH` can OOM.

### 3. Throughput observability

- Add a pure `parseTurnMetrics(footer)` that extracts prompt-eval tok/s and eval
  (generation) tok/s from llama-cli's `[ Prompt: … t/s ]` / `[ … eval time … ]`
  footer text the runtime already captures.
- When `WRITER_LOCAL_PERF_LOG=1`, log the parsed metrics per turn (stderr/daemon
  log). Off by default; no behavior change otherwise.
- This is the verification mechanism and the input to a future spec-decoding call.

### 4. Build/kernel verification (operational, not code)

- One-time check: run a short generation with logs enabled and confirm the
  startup banner shows the CUDA0 Blackwell device and `flash_attn = 1`.
- If prefill remains low after `-ub` tuning, flag a Blackwell-targeted
  (`sm_120`, CUDA 12.8) llama.cpp rebuild as a separate follow-up. Out of scope
  for this code change.

## Risks / trade-offs

- **Small decode gain.** FA is likely already auto-on and Q8 is near the bandwidth
  wall, so decode may move only ~50→~55. The honest, primary win is prefill.
- **VRAM from larger ubatch.** Bounded at 1024; interacts with the dependency's KV
  budget. Verified at load; documented OOM risk for forced larger values.
- **Footer format drift.** `parseTurnMetrics` must tolerate llama-cli footer
  variations; return nulls rather than throwing on an unrecognized footer.

## Verification

- `npm run typecheck`, `npm run test`.
- `openspec validate tune-local-inference-speed --type change --strict`.
- Manual: with `WRITER_LOCAL_PERF_LOG=1`, record prompt-eval and eval tok/s before
  vs after; confirm prefill rises and decode is unchanged-or-better; confirm
  `flash_attn = 1` in the banner.
