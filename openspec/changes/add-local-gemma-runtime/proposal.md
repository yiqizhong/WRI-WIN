## Why

Writer needs a fully local model option for company-internal workflows where project data can be processed by the app but must not be sent to third-party inference providers. Users should be able to download Gemma 4 E4B from an approved source, then run it locally inside Writer without installing Ollama, LM Studio, or any external runtime.

## What Changes

**Local Gemma model lifecycle**
- From: Writer relies on external provider adapters or user-managed runtimes for LLM execution.
- To: Writer provides an in-app Gemma 4 E4B local model entry with download, verification, installation, readiness, and failure states.
- Reason: Users need a first-party local model path that keeps prompts, project knowledge, and outputs in the app-managed local environment.
- Impact: Non-breaking. Existing Cursor, Devin, and BYOK planning remain separate runtime options.

**Local inference runtime**
- From: Local model execution would require an external runtime such as Ollama or a third-party API.
- To: Writer daemon manages a private local inference runtime and exposes it through the existing agent run event model.
- Reason: The app must hide background operations and avoid external runtime setup.
- Impact: Adds daemon-side model/runtime management and packaging responsibilities.

**Network boundary**
- From: Model execution paths may involve cloud providers or external tools.
- To: Network access is allowed for approved model artifact download, but inference MUST NOT send business data, prompts, knowledge files, or outputs to third parties.
- Reason: Downloading a model does not expose company data; runtime inference must remain a local closed loop.
- Impact: Requires explicit download-vs-inference network separation.

## Capabilities

### New Capabilities

- `local-model-runtime`: app-managed local model download, install, readiness, and inference for Gemma 4 E4B.

### Modified Capabilities

- `agent-adapter-runtime`: include the local Gemma runtime as a selectable agent adapter that emits normalized run events.

## Impact

- `apps/desktop`: add a Local Models entry/surface and runtime selection states.
- `apps/daemon`: add model download, progress, verification, install, readiness, runtime process management, and local inference orchestration.
- `packages/contracts`: add model lifecycle schemas and extend adapter/runtime metadata where needed.
- `packages/agent-adapters`: add a local Gemma adapter backed by daemon-managed local inference.
- `packages/storage`: persist installed model metadata, download state, and active local runtime configuration.
- Build/distribution: package a Writer-managed inference binary or sidecar without bundling model weights.

Non-goals for this slice: model marketplace, multiple local models, fine-tuning, training, multimodal support, full 128K context productization, advanced GPU tuning UI, and external local-model server APIs.
