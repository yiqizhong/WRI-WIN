Brainstorm capture for `expand-local-context-window` (superpowers:brainstorming, 2026-05-29).

## Problem

When a user sends many messages in a Local Gemma chat (or reopens the app with a
long conversation), the request hits a token limit and inference truncates or
fails. The user asked: how large should the local context window be, and what is
the realistic maximum?

## Diagnosis (from code)

- The cap is hardcoded in the runtime, not a model limit: `--ctx-size 4096`
  appears in two places — the resident process
  (`packages/agent-adapters/src/adapters/local-gemma-runtime.ts:101`) and the
  cold-spawn fallback (`packages/agent-adapters/src/adapters/local-gemma-adapter.ts`).
- The manifest already disagrees with the runtime:
  `apps/daemon/src/local-model-manifest.ts` declares `defaultContext: 8192` and
  `modelMaxContext: 131072`, but the runtime spawns at 4096.
- History is re-injected into every turn's prompt by the daemon
  (`packages/review-core/src/copywriter-skill.ts` `buildCopywriterPrompt`), and it
  is trimmed only by **message count** (`HISTORY_LIMIT = 6`), not by tokens. So a
  few long messages plus the fixed guideline/brand-voice context plus the 512-token
  reply (`-n 512`) can exceed 4096 even within the 6-message cap.

## Research (context window ceiling)

- Hardware: NVIDIA RTX PRO 3000 Blackwell Laptop GPU, 12 GB VRAM. The Q8 model
  file is ~8.6 GB, leaving ~3 GB for KV cache + compute buffers. The binding
  constraint is VRAM, not the model architecture.
- Model: Gemma 4 E4B. Manifest claims 131072 (128K); realistic/trained context for
  E4B is ~32K. 128K is a theoretical ceiling the 12 GB card cannot hold.
- KV-cache memory grows linearly with context. An 8B-class model at 32K FP16 KV is
  roughly ~4.5 GB — more than the free headroom, so full 32K FP16 will not fit.
- Gemma 3 uses interleaved sliding-window attention (5 local : 1 global), making
  its KV cache unusually cheap, so 16K FP16 may fit in ~3 GB. KV quantization
  (q8_0 ≈ half, q4_0 ≈ quarter) is the lever if it does not.

## Decisions (user)

1. Target context window: **16K** (4× today), sourced from the manifest.
2. Overflow behavior: **trim oldest (sliding window), keep going, no UI warning.**
3. New-chat reset: **true zero-context reset** at the model level — a new chat must
   not inherit the prior chat's KV cache. (UI "New Chat" button and
   `POST /paste-text/conversations` endpoint already exist.)
4. KV precision: **FP16 first, q8 fallback** — keep full ~50 tok/s when 16K fits in
   FP16; quantize only if it does not.

## Speed analysis (user asked)

- Raising the ceiling alone: no per-token cost (ctx-size is just the cap).
- Token-aware trimming: neutral-to-positive (bounds prefill / TTFT).
- New-chat reset: one-time ~4–5 s reload only when switching chats; no throughput change.
- q8 KV: the only per-token cost (a few % on CUDA) — now only applies if FP16 16K
  does not fit.

## Non-goals

- Full 128K/32K context productization, GPU tuning UI, multiple local models,
  streaming token output, persisting summarized history across trims.
