# Brainstorm — add-speculative-decoding

## Problem framing

Local Gemma decode runs ~40 t/s on the RTX PRO 3000 Blackwell (12 GB, 672 GB/s). The Q8 bandwidth ceiling is ~78 t/s (`672 ÷ 8.6`). After `tune-local-inference-speed` landed (flash attention + `-ub 1024`), prefill jumped to ~2490 t/s but decode dropped slightly from the larger KV cache (16K context). We're at ~51% of the bandwidth ceiling with no further single-engine knob to turn.

Switching engines (ExLlamaV2) was researched and rejected: Blackwell sm_120 forces Flash Attention off in ExLlamaV2 (losing its main edge), Gemma 4 architecture support is unverified, and ExLlamaV2 has no `-cnv` stdin protocol — adopting it would mean rewriting the resident-process runtime as an HTTP client to TabbyAPI. High risk for an uncertain gain.

Speculative decoding is the right next lever. It's **lossless** (target model validates every token), supported in llama.cpp via `--model-draft`, and Google released a **dedicated draft model** alongside Gemma 4 E4B specifically for this purpose. Sources:
- arxiv.org/html/2402.16363v4 — decode is memory-bandwidth-bound; spec decoding reduces bandwidth per accepted token
- ai.google.dev/gemma/docs/core — "All Gemma 4 models include a dedicated draft model for speculative decoding"

## Decisions locked in brainstorming

| Q | Decision | Why |
|---|---|---|
| Draft model source | **Separate optional download** (not bundled, not auto) | Keeps base install lean; user opts in to extra ~500 MB and ~1 GB VRAM |
| Activation | **Download + Settings toggle** (off by default after install) | User keeps escape hatch if VRAM is tight; doesn't surprise on first launch |
| Failure handling | **Silent fallback + UI banner** | Mirrors FP16→q8 KV fallback pattern; chat never breaks on a "speed" feature |
| Tuning knobs | **Defaults only, env-overridable, no UI** | `draft-max`/`draft-min` tuning is research, not user-facing |

## Non-goals

- Tuning UI for `draft-max` / `draft-min` (env-overridable only via `WRITER_LOCAL_DRAFT_MAX` / `WRITER_LOCAL_DRAFT_MIN`)
- Auto-download draft when main model installs (separate user action)
- Auto-enable toggle on install (user must explicitly turn on)
- Multiple draft models per main model
- Speculative decoding for other adapters (Codex, Claude Code) — Local Gemma only
- Bundling the draft inside the app installer
