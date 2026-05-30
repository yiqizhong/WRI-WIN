Brainstorm capture for `tune-local-inference-speed` (superpowers:brainstorming, 2026-05-29).

## Problem

Local Gemma generation runs at ~50 tok/s (decode) and ~200 tok/s (prompt
processing / "reading"). The user wants it faster — speed, not quality — and
cited research suggesting an 8B on an NVIDIA GPU can reach ~100 tok/s.

## Diagnosis

- Model: Gemma 4 E4B **Q8_0** GGUF, ~8.6 GB. Runtime: bundled `llama-cli`
  b9384 (48e7078ee) on CUDA 12.8, `-ngl 99` (all layers on GPU).
- Current spawn flags do NOT set `-fa` or batch sizes. `-fa` defaults to `auto`,
  which on CUDA enables flash attention when supported (Gemma qualifies), so FA
  is very likely already active. `-ub` (physical batch) is the default 512.

## Research (web + on-device)

- Decode is **memory-bandwidth-bound**: `tok/s ≈ bandwidth ÷ bytes_read_per_token`.
- GPU: NVIDIA RTX PRO 3000 Blackwell Laptop — **672 GB/s**, 12 GB GDDR7, 192-bit.
- Q8 hard ceiling: `672 ÷ 8.6 ≈ 78 tok/s` at 100% efficiency; ~58–66 tok/s
  realistic (~75–85%). The user is at 50 → already ~75% of realistic ceiling.
- The "~100 tok/s for 8B" figures are **Q4** numbers: Q4_K_M ≈ 5 GB →
  `672 ÷ 5 ≈ 134` theoretical → ~100 real. (8B Q4 benchmarks: ~104 tok/s on RTX
  4090, ~52 on 4070.)
- Flash attention on Blackwell: ~10–27% (NVIDIA/LM Studio), mostly attention /
  long-context / prefill; little for short-context decode.
- The only no-quality-loss lever past the ~78 wall is **speculative decoding**
  (verify K draft tokens per weight-streaming pass).

## Decisions (user)

1. **Keep Q8_0 — zero quality loss.** No quantization change.
2. **Safe tuning only** (no speculative decoding for now). Explicitly accept that
   ~100 tok/s is not reachable on Q8 by tuning; target the realistic wins.

## Scope (safe, no-quality-loss tuning)

1. Make flash attention explicit (`-fa on`), env-overridable.
2. Raise the prefill physical batch (`-ub` 512 → 1024), env-overridable; bounded
   to fit VRAM alongside the 16K-context KV from `expand-local-context-window`.
3. Capture llama-cli's per-turn `[ Prompt: … t/s ]` footer metrics behind a perf
   log flag, so gains are measurable and we can decide later about spec-decoding.

## Expected outcome (honest)

- Decode ~50 → ~55 (Q8 is the wall; FA likely already on).
- Prefill / reading speed substantially improved via larger `-ub`.
- ~100 tok/s remains out of reach without Q4 or speculative decoding (both deferred).

## Dependency

Builds on `expand-local-context-window` — extends the same `buildSpawnArgs` helper
in `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`.

## Non-goals

Quantization change, speculative decoding / draft models, multi-GPU, a custom
Blackwell-targeted llama.cpp rebuild (flagged as a follow-up if prefill stays low),
streaming token output, desktop perf UI.
