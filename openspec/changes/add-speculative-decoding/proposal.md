## Why

Local Gemma decode is stuck at ~40 t/s on the RTX PRO 3000 Blackwell after `tune-local-inference-speed` landed — about 51% of the Q8 bandwidth ceiling (~78 t/s) and not improvable through further llama-cli flag tuning. Decode is memory-bandwidth-bound: each token requires reading the full 8.6 GB model from VRAM, so no engine choice can break the ceiling.

Speculative decoding is the right next lever. A small draft model proposes the next N tokens; the main model verifies them in a single forward pass, accepting the longest correct prefix. Output is mathematically identical to running the main model alone — **zero quality loss**. Google released a dedicated draft model alongside Gemma 4 E4B specifically for this use, so we get high acceptance rate without hunting for a compatible model.

The change targets the runtime spawn-arg path that the previous two changes already established (`expand-local-context-window`, `tune-local-inference-speed`). No new dependency, no engine swap.

## What Changes

**Optional draft model installation**
- From: Local model manifest declares only the main GGUF; install flow downloads one file.
- To: Manifest gains an optional `draftModel: { url, sha256, sizeBytes, fileName }` field. A new `installDraftModel(modelId)` flow downloads and SHA-verifies the draft alongside the main model. The draft is **not** auto-installed; the user clicks "Install draft model (~500 MB)" in Settings.
- Reason: Lossless decode speedup is opt-in because it adds ~1 GB VRAM pressure on a 12 GB card; users with tighter VRAM should not pay that cost by default.
- Impact: Non-breaking. Manifests without `draftModel` still install exactly as today.

**Speculative-decoding toggle**
- From: No toggle; runtime always spawns llama-cli without `--model-draft`.
- To: Storage gains `localGemma.speculativeDecoding = { enabled: boolean, lastError?: string }`. Settings exposes an "Speed boost" toggle, disabled until the draft is installed. Turning the toggle on evicts the runtime so the next chat turn spawns with `--model-draft <path>`.
- Reason: Decouples installation from activation, so users who hit VRAM issues can flip it off without uninstalling. Matches the env-override pattern from prior changes.
- Impact: Existing setups behave as today until the user explicitly enables the toggle.

**Resident + cold-spawn parity for `--model-draft`**
- From: `buildSpawnArgs` ignores draft configuration.
- To: `buildSpawnArgs` gains `draftModelPath: string | null`; appends `--model-draft <path>` when non-null. The cold-spawn path in `local-gemma-adapter.ts` carries the same flag. A new pure helper `resolveDraftModelPath(envOverride, settings)` orders sources: `WRITER_LOCAL_DRAFT_MODEL` env > settings path when toggle on > null.
- Reason: Symmetry with `expand-local-context-window` (`buildSpawnArgs` + cold-spawn fallback) and `tune-local-inference-speed` (`-fa`/`-ub` in both paths).
- Impact: Internal; no public API change.

**Silent fallback with UI surface**
- From: A draft-load VRAM failure would crash the runtime.
- To: The runtime detects the draft-load failure signature on spawn, respawns once without `--model-draft`, persists `lastError` in storage, and emits a `draftModelDisabled` event. The renderer surfaces a Settings-panel banner with [Retry] / [Disable] buttons. For the runtime's lifetime, the draft is not retried (mirrors the FP16→q8 KV fallback rule).
- Reason: Chat must never break because a speed feature failed. Banner keeps the user informed without blocking.
- Impact: New error code surface; storage migration adds `speculativeDecoding` slice with default `{ enabled: false }`.

## Capabilities

### Modified Capabilities

- `agent-adapter-runtime`: the Local Gemma runtime accepts an optional draft model for speculative decoding, applies it across both spawn paths, and falls back to non-speculative when the draft fails to load.
- `local-model-runtime`: model manifests may declare an optional draft companion, and the install flow can download and verify it on demand.

## Impact

- `apps/daemon/src/local-model-manifest.ts`: add optional `draftModel` field to the manifest schema; populate for Gemma 4 E4B with Google's official draft.
- `apps/daemon/src/local-model-install.ts` (or equivalent): add `installDraftModel(modelId)` action.
- `apps/daemon/src/routes` (or equivalent): add `POST /local-model/draft/install`, `PUT /local-model/draft/enabled`.
- `packages/storage`: persist `localGemma.speculativeDecoding = { enabled, lastError? }`; migration defaults to `{ enabled: false }`.
- `packages/contracts`: extend adapter status DTO with `draftModel: { installed, enabled, lastError? }`.
- `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`: add `resolveDraftModelPath`, extend `buildSpawnArgs`, detect draft-load failure and fallback once.
- `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`: apply `--model-draft` on the cold-spawn fallback.
- `apps/desktop`: Settings panel "Speed boost" section — Install button, toggle, banner.

Non-goals: tuning UI for `draft-max` / `draft-min` (env-overridable only), auto-download on main-model install, auto-enable on install, multiple draft models per main model, speculative decoding for non-Gemma adapters, bundling the draft inside the app installer.

## Dependency

Depends on `expand-local-context-window` and `tune-local-inference-speed` (both archived). Extends their shared `buildSpawnArgs` + cold-spawn helpers.
