## Why

Writer ships a single `Q8_0` (~8.6 GB) local model quant. Sub-12 GB NVIDIA GPU users download the full file and hit a hard CUDA out-of-memory error at load — they pay the full download cost for a model that can never run. This change auto-selects the right quant for the user's hardware so every supported NVIDIA GPU gets a model that actually fits.

## What Changes

**Local model download — quant selection**
- From: Single hardcoded `Q8_0` manifest used for all devices.
- To: Runtime quant selection based on detected NVIDIA total VRAM: `Q8_0` for ≥12000 MiB, `Q4_K_M` for <12000 MiB, blocked (no download) when VRAM is undetectable.
- Reason: Prevents sub-12 GB users from downloading an unrunnable model.
- Impact: Non-breaking for existing 12 GB+ installs; new behavior for sub-12 GB users.

**Local LLM tile — displayed model size**
- From: Always shows the Q8_0 size (~8.6 GB).
- To: Shows the resolved quant's real size (~8.6 GB for Q8_0, ~5.3 GB for Q4_K_M).
- Reason: Users should see the size of the file they will actually download.
- Impact: UI-only change.

**Local LLM tile — blocked state**
- From: Download button always shown.
- To: In the blocked state ("No compatible NVIDIA GPU detected"), the Download button is replaced with an explanatory inline message.
- Reason: Prevents a download that cannot run from being initiated.
- Impact: UI-only change; only visible on machines with no detectable NVIDIA GPU.

## Capabilities

### New Capabilities

- `local-model-quant-selection`: VRAM-based quantization selection for the local Gemma model — manifest constants for Q8_0 and Q4_K_M, VRAM detection, pure resolver, daemon model-layer integration, and blocked-state UI.

### Modified Capabilities

- `agent-adapter-runtime`: `listGpuDevices` extended to also capture and export total NVIDIA VRAM (`detectNvidiaVram()`).

## Impact

- `apps/daemon/src/local-model-manifest.ts` — add Q4_K_M manifest constant and resolver function.
- `apps/daemon/src/local-models.ts` — route `getLocalModelStatus`, `startModelDownload`, `getModelFilePath` through resolver.
- `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` — export `detectNvidiaVram()`.
- `apps/desktop/src/agents-panel.tsx` — display resolved quant size; show blocked message.
- No new dependencies; no schema or API contract changes.
