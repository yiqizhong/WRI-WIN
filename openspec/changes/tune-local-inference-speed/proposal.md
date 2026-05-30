## Why

Local Gemma generation runs at ~50 tok/s (decode) and ~200 tok/s (prompt
processing). Users want it faster without trading model quality. On-device and
web research show why 50 is close to the practical ceiling for this setup:
decode is memory-bandwidth-bound, and the model is Q8_0 (~8.6 GB). The GPU (RTX
PRO 3000 Blackwell Laptop) has 672 GB/s of bandwidth, so the Q8 decode ceiling is
`672 ÷ 8.6 ≈ 78 tok/s` (≈58–66 tok/s realistically) — the user is already at ~75%
of that. The widely-cited "~100 tok/s for an 8B" figures assume Q4 (~5 GB), not
Q8.

Given the decision to keep Q8 (zero quality loss) and avoid speculative decoding
for now, this change applies the safe, no-quality-loss tuning that is currently
left on the table: deterministic flash attention, a larger prefill batch (the real
lever for the ~200 tok/s "reading" speed), and per-turn throughput logging so the
gains are measurable and a future speculative-decoding decision is evidence-based.

This builds on `expand-local-context-window`, extending the same runtime spawn-arg
path.

## What Changes

**Flash attention is explicit**
- From: The runtime passes no `-fa` flag, relying on llama-cli's `auto` default.
- To: The runtime passes `-fa on` (env-overridable via `WRITER_LOCAL_FLASH_ATTN`).
- Reason: Make FA deterministic rather than dependent on the build's auto heuristic; FA also reduces KV bandwidth, helping prefill and longer-context turns.
- Impact: No quality change; small or no decode change if auto already enabled FA.

**Prefill batch tuning**
- From: Physical batch size is the default 512 (`-ub` unset).
- To: The runtime passes `-ub 1024` (env-overridable via `WRITER_LOCAL_UBATCH`), bounded to fit VRAM alongside the 16K-context KV cache.
- Reason: Prompt processing ("reading speed") scales with physical batch on GPU; this is where the real headroom is.
- Impact: Faster time-to-first-token; modestly higher transient VRAM during prefill.

**Throughput observability**
- From: llama-cli's per-turn `[ Prompt: … t/s ]` footer is parsed only to strip it.
- To: When `WRITER_LOCAL_PERF_LOG=1`, the runtime extracts prompt-eval and eval tok/s from the footer and logs them.
- Reason: Make before/after gains measurable and inform a later speculative-decoding decision.
- Impact: Opt-in logging only; no behavior change when the flag is unset.

## Capabilities

### Modified Capabilities

- `agent-adapter-runtime`: the Local Gemma runtime enables flash attention deterministically, sizes the prefill batch (both env-overridable), and can log per-turn throughput.

## Impact

- `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`: extend `buildSpawnArgs` (from `expand-local-context-window`) with `-fa` and `-ub`; add a pure footer-metrics parser; emit metrics when the perf-log flag is set.
- `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`: apply the same `-fa`/`-ub` flags on the cold-spawn fallback.

Non-goals: quantization change (Q8 stays), speculative decoding / draft models, a custom Blackwell-targeted llama.cpp rebuild (a follow-up if prefill stays low), multi-GPU, streaming token output, and any desktop perf UI.

## Dependency

Depends on `expand-local-context-window` (shared `buildSpawnArgs`). Land that change first.
