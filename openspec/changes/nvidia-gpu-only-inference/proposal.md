# Proposal: NVIDIA GPU-Only Inference for Local Gemma

## Why

The local Gemma adapter spawns `llama-cli` without `-ngl` (GPU layer offload flag).
llama.cpp defaults to CPU-only inference when `-ngl` is absent. On the target hardware
(NVIDIA RTX workstations), this causes inference to time out or produce empty output,
resulting in the user-visible error "Agent returned empty rewrite".

The fix is to add `-ngl 99` to the llama-cli spawn args to fully offload to GPU.

The user's requirement goes further: inference must run **exclusively on NVIDIA GPU**
and must fail fast if NVIDIA GPU is unavailable — no silent CPU fallback.

## What Changes

1. **`llama-cli` spawn args** — add `-ngl 99` (or `WRITER_GPU_LAYERS` override).
2. **NVIDIA GPU detection** — `detect()` checks for NVIDIA GPU via `nvidia-smi`
   before reporting the adapter as available.
3. **Contracts** — add `"gpu_not_available"` to `ConnectionDiagnosticCode`.
4. **Design update** — update `add-local-gemma-runtime/design.md` to record the
   NVIDIA-only decision.

## Capabilities

### New Capabilities
- `nvidia-gpu-detection` — detects NVIDIA GPU availability using `nvidia-smi`;
  gates the local-gemma adapter on GPU presence.

### Modified Capabilities
- `local-gemma-adapter` (in `add-local-gemma-runtime` change) — spawn args now
  include `-ngl 99`; `detect()` fails if NVIDIA GPU is absent.

## Impact

- `packages/contracts/src/connection-diagnostic.ts` — add `gpu_not_available` code.
- `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` — GPU detection + spawn arg.
- `packages/agent-adapters/src/adapters/gpu-detect.ts` — new helper (or inline).
- `openspec/changes/add-local-gemma-runtime/design.md` — add GPU decision.

## Non-Goals

- Partial GPU offload (mixed CPU+GPU) — explicitly excluded.
- AMD or Intel GPU support — out of scope.
- GPU tuning UI — remains a non-goal per the parent change.
- macOS Metal path — separate concern; this change targets Windows/NVIDIA only.
