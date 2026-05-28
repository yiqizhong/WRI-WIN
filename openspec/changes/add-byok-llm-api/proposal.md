## Why

Writer currently depends on local provider paths such as Cursor and Devin for model execution. Users who already have a provider API key should be able to paste it and complete a basic model run without installing another CLI, configuring environment variables, or learning provider internals.

## What Changes

**Minimal BYOK API setup**
- From: Users must rely on detected local provider adapters.
- To: Users can paste an API key for one supported BYOK provider preset, test it, save it locally, select it as the active runtime, and complete a basic request.
- Reason: The first slice should prove the paste-and-run path before expanding provider coverage.
- Impact: Non-breaking. Existing Cursor and Devin paths remain available.

**Provider configuration complexity**
- From: BYOK concepts may require explicit base URL, protocol, and model details.
- To: V1 hides those details behind one provider preset and defaults.
- Reason: The user goal is "paste key and run", not full provider management.
- Impact: Advanced provider configuration remains out of scope for this change.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `llm-byok-proxy`: make the minimal BYOK path user-facing and runnable through a pasted API key, connection test, local save, active runtime selection, and a basic model request.

## Impact

- `apps/desktop`: add the paste-key setup affordance to the model/runtime settings surface and expose test/save/use states.
- `apps/daemon`: add or complete the minimal config/test/run endpoints needed for the preset.
- `packages/contracts`: add shared schemas for BYOK config/test responses if missing.
- `packages/agent-adapters`: add or complete the BYOK adapter path so the existing agent run flow can call the selected API runtime.
- `packages/storage`: persist the minimal local BYOK config while avoiding accidental key exposure in logs or UI.

Non-goals for this slice: multiple provider management, model discovery, custom base URL UI, custom headers, cost tracking, fallback routing, tool calling parity, and multimodal support.
