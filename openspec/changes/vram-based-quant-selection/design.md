## Context

Writer bundles `gemma-4-E4B-it-Q8_0.gguf` (~8.6 GB) as the only local model quant. The app's CUDA-only llama.cpp build exclusively enumerates NVIDIA GPUs — AMD, Intel, and integrated GPUs are invisible. Sub-12 GB NVIDIA users (e.g. RTX 3070 Ti, 8 GB) download the full model and hit a hard CUDA OOM at load, having paid the entire ~8.6 GB download cost for something that cannot run.

Affected paths:
- `apps/daemon/src/local-model-manifest.ts` — manifest constants
- `apps/daemon/src/local-models.ts` — model status, download, path resolution
- `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` — GPU device probe
- `apps/desktop/src/agents-panel.tsx` — Local LLM tile UI

## Goals / Non-Goals

**Goals:**
- A 12 GB+ NVIDIA GPU downloads and runs `Q8_0` (current behavior, unchanged).
- An 8 GB-class NVIDIA GPU downloads and runs `Q4_K_M` (~5.34 GB), which fits in 8 GB with KV cache headroom.
- No machine downloads a model that cannot run.
- The UI reflects the selected quant's real file size.
- In the blocked state (no compatible NVIDIA GPU detected), the Download button is replaced with an explanatory message.

**Non-Goals:**
- Migrating users who already downloaded a quant under single-manifest behavior.
- GPU-swap handling or re-selection after hardware changes.
- Partial CPU/GPU offload for cards below 8 GB.
- User-facing manual override of the chosen quantization.

## Decisions

### D1: Runtime quant selection (not build-time or user-driven)
- **Choice:** Auto-select quant at daemon runtime based on detected NVIDIA VRAM.
- **Rationale:** Zero UX friction — the user never needs to know what a quant is. Build-time selection would require separate installers. Manual selection adds UX burden and requires users to understand model sizes.
- **Alternatives considered:** Single quant forever (rejects sub-12 GB users); user picker (UX burden, misclick risk).

### D2: Threshold 12000 MiB, not 12288 MiB
- **Choice:** `VRAM_Q8_MIN_MIB = 12000`.
- **Rationale:** Real 12 GB GPUs report slightly under their nominal capacity (e.g. a 12 GB RTX reports 12000 MiB, not 12288 MiB). Using 12288 would misclassify a real 12 GB card and serve it the smaller quant.
- **Alternatives considered:** 12288 MiB (binary exact) — would wrongly downgrade real 12 GB cards.

### D3: Two quants only (Q8_0 and Q4_K_M); block below 8 GB
- **Choice:** `Q8_0` for ≥12000 MiB, `Q4_K_M` for <12000 MiB, `blocked` for null VRAM.
- **Rationale:** `Q4_K_M` (~5.34 GB) fits in 8 GB with room for KV cache. Smaller quants add complexity and quality loss without a clear target device. Blocking is safer than guessing — an un-runnable download is strictly worse than no download.
- **Q4_K_M confirmed values** (ggml-org/gemma-4-E4B-it-GGUF, sourced 2026-06-02):
  - `fileName`: `gemma-4-E4B-it-Q4_K_M.gguf`
  - `downloadUrl`: `https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf`
  - `expectedSha256`: `90ce98129eb3e8cc57e62433d500c97c624b1e3af1fcc85dd3b55ad7e0313e9f`
  - `fileSizeBytes`: `5335289824`

### D4: VRAM detection extends existing listGpuDevices in local-gemma-adapter
- **Choice:** Extend the existing `llama-cli --list-devices` probe in `local-gemma-adapter.ts` to also extract total MiB; export `detectNvidiaVram(): Promise<number | null>`.
- **Rationale:** The probe is already there, result is cached, and the CUDA-only build means only NVIDIA GPUs appear — no device-type filtering needed.
- **Alternatives considered:** Separate probe (duplicates process spawn); `nvidia-smi` (not bundled, unavailable on all target machines).

### D5: Pure resolver function; no I/O in selection logic
- **Choice:** `resolveLocalModelManifest(vram: number | null): { manifest: LocalModelManifest } | { blocked: true, reason: string }` is a pure function alongside the manifest constants.
- **Rationale:** Pure functions are trivially unit-testable at the boundary cases. The I/O (VRAM detection) is separated into `detectNvidiaVram()`.

### D6: Blocked state surfaced as a status field, not an error
- **Choice:** `getLocalModelStatus` returns a `blocked` variant with a `reason` string; `startModelDownload` refuses with a clear error message.
- **Rationale:** The blocked state is a normal, expected outcome (e.g. integrated-GPU-only laptop), not an exception. Surfaces cleanly in the UI without error toasts.

## Risks / Trade-offs

- [Risk] VRAM parse brittle if llama.cpp output format changes → Mitigation: unit-test the parser against representative output; `null` on parse failure fails safe (blocked).
- [Risk] Cache persists for daemon session; GPU state could theoretically change (GPU swap, driver reinstall) → Accepted: YAGNI, documented as non-goal; cache lifetime matches a normal session.
- [Trade-off] Sub-12 GB users who already installed Q8_0 are not migrated → Accepted for v1; manual delete-and-re-download is the fallback.
- [Risk] Q4_K_M SHA256 or URL could change if ggml-org updates the file → Mitigation: SHA256 verified at download time; mismatch fails the download, not silently corrupts.

## Migration Plan

N/A — this change adds new manifest constants and a resolver. No endpoint, database schema, or stored state changes. Existing Q8_0 installs are unaffected.

## Open Questions

None — all design decisions are locked per the approved spec (`docs/superpowers/specs/2026-06-02-vram-based-model-quant-selection-design.md`).
