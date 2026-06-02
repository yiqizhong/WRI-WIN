# VRAM-Based Local Model Quantization Selection

Date: 2026-06-02
Status: Approved design, ready for implementation planning

## Idea

The bundled local LLM currently ships a single quantization of Gemma 4 E4B — `Q8_0` (~8.6 GB). That file is larger than an 8 GB GPU's total VRAM, so users with a sub-12 GB NVIDIA card download the full model and then hit a hard CUDA out-of-memory failure when it tries to load. They pay the whole download cost for something that can never run.

This change picks the right quantization for the user's hardware: machines with a 12 GB-or-larger NVIDIA GPU keep the high-quality `Q8_0`; machines with a smaller NVIDIA GPU get `Q4_K_M` (~5.34 GB), which fits in 8 GB with room for the KV cache. If we cannot positively read a compatible NVIDIA GPU's VRAM, we block the download and show a message rather than guess.

## Goals

- An 8 GB-class NVIDIA GPU downloads and runs a model that actually fits (`Q4_K_M`).
- A 12 GB+ NVIDIA GPU keeps today's behavior (`Q8_0`).
- No machine downloads a model it cannot run.
- Selection only ever considers the NVIDIA (CUDA) GPU — never the integrated GPU. This is already guaranteed by the CUDA-only llama.cpp build; this design preserves it.

## Non-Goals (YAGNI)

- Migrating users who already downloaded a quant under the old single-manifest behavior.
- Handling a GPU swap mid-session or re-selecting after hardware changes.
- Partial CPU/GPU offload for cards too small for even `Q4_K_M`.
- User-facing manual override of the chosen quantization.

## Selection Rule

A single pure function maps detected NVIDIA total VRAM to an outcome:

| Detected total VRAM | Outcome |
|---|---|
| `>= 12000 MiB` | `Q8_0` (current model) |
| `< 12000 MiB` | `Q4_K_M` |
| `null` (no NVIDIA GPU / VRAM unreadable) | `blocked` |

The threshold is **12000 MiB**, not 12288 MiB (the exact binary value of 12 GB), so that a real 12 GB card reporting slightly under its nominal capacity still counts as a 12 GB card and receives `Q8_0`. Only genuinely smaller cards drop to `Q4_K_M`.

## Components

### 1. Two manifests instead of one

`apps/daemon/src/local-model-manifest.ts` currently exports a single `GEMMA_4_E4B_MANIFEST` (`Q8_0`). Add a second manifest for `Q4_K_M`, sharing the same `modelId` and `displayName` (they are two downloads of the same logical model), differing in `fileName`, `downloadUrl`, `expectedSha256`, and `fileSizeBytes`.

Confirmed `Q4_K_M` values from the source repo `ggml-org/gemma-4-E4B-it-GGUF` (Git LFS pointer, sourced 2026-06-02):

- `fileName`: `gemma-4-E4B-it-Q4_K_M.gguf`
- `downloadUrl`: `https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf`
- `expectedSha256`: `90ce98129eb3e8cc57e62433d500c97c624b1e3af1fcc85dd3b55ad7e0313e9f`
- `fileSizeBytes`: `5335289824`

### 2. NVIDIA VRAM detection

`packages/agent-adapters/src/adapters/local-gemma-adapter.ts` already has `listGpuDevices`, which runs `llama-cli --list-devices` and parses lines like:

```
CUDA0: NVIDIA GeForce RTX 4070 (12288 MiB, 12000 MiB free)
```

Extend it to capture the **total MiB** value, and export a `detectNvidiaVram()` that returns the total MiB of the primary CUDA device (`CUDA0`), or `null` when no CUDA device is present or the MiB cannot be parsed.

- Because the bundled llama.cpp is a CUDA build, only NVIDIA GPUs are ever enumerated; the integrated GPU is invisible to this path. No device-index logic is needed.
- The result is cached for the daemon session (the GPU does not change at runtime), so frequent UI polling does not spawn a probe each time.
- The existing string-list behavior of `listGpuDevices` (used for GPU-presence enforcement) must be preserved; VRAM parsing is additive.

### 3. Manifest resolution in the model layer

`apps/daemon/src/local-models.ts` references the single manifest constant throughout. Introduce a resolver that, given the detected VRAM, returns either `{ manifest }` or `{ blocked, reason }`, and route the relevant functions through it:

- `getLocalModelStatus` — returns the resolved manifest (so the UI shows the correct size) or a blocked indicator.
- `startModelDownload` — downloads the resolved manifest's file; refuses with a clear error when blocked.
- `getModelFilePath` — uses the resolved manifest's `fileName`.

Functions that operate on an already-installed file rely on the stored `modelPath` in model state, not the manifest, and need no behavioral change.

### 4. Blocked state surfaced to the UI

`getLocalModelStatus` gains a way to express "no compatible NVIDIA GPU detected" (e.g. a status/flag plus a human-readable reason). The Local LLM tile in `apps/desktop/src/agents-panel.tsx`:

- Shows the **selected** model's real size — an 8 GB user sees ~5.3 GB, a 12 GB user sees ~8.6 GB.
- In the blocked state, replaces the Download button with a short message ("No compatible NVIDIA GPU detected") instead of allowing a download that cannot run.

## Data Flow

1. UI requests local model status.
2. Daemon calls `detectNvidiaVram()` (cached).
3. Resolver maps VRAM → `Q8_0` manifest, `Q4_K_M` manifest, or `blocked`.
4. Status response carries the chosen manifest (name, size, file) or the blocked reason.
5. On Download, `startModelDownload` resolves the same way and fetches the matching file, verifying it against that manifest's `expectedSha256`.

## Error Handling

- **No NVIDIA GPU / unreadable VRAM** → `blocked`; no download offered; UI explains why.
- **Checksum mismatch** → existing behavior (delete partial, mark failed) applies per-manifest using the correct expected hash.
- **Detection probe fails to spawn** → treated as `null` VRAM → `blocked` (fail safe, never guess high).

## Testing

Pure functions, unit-tested:

- **Selection rule** — boundary cases: `8192`, `11999`, `12000`, `12288`, and `null` map to `Q4_K_M`, `Q4_K_M`, `Q8_0`, `Q8_0`, `blocked` respectively.
- **VRAM line parser** — extracts total MiB from a representative `CUDA0: … (12288 MiB, 12000 MiB free)` line; returns `null` for CPU-only output and malformed lines.
- **Manifest resolver** — returns the expected manifest or blocked outcome for each VRAM case.

## Open Dependencies

None blocking. The `Q4_K_M` file existence, checksum, and size are confirmed against the live source repo.
