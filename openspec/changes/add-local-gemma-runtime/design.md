## Context

Writer is a local-first desktop app with a renderer, a privileged daemon, shared contracts, local storage, and normalized agent run events. The new local model capability should let users download Google Gemma 4 E4B from an approved source, install it locally, and run inference inside Writer without relying on Ollama, LM Studio, cloud inference APIs, or user-managed runtime setup.

The privacy boundary is stage-specific:

- Model acquisition may connect to Google or another approved artifact source because no business data is uploaded.
- Inference must not send project files, knowledge base content, prompts, model inputs, generated output, or logs to third-party services.

The user's target machines are high-spec company workstations with NVIDIA RTX GPUs, 64GB RAM, and 1TB storage. V1 should still provide status/error handling, but does not need to optimize for low-end machines.

Affected areas:

- `apps/desktop`: Local Models UI and runtime selection affordances.
- `apps/daemon`: model download/verify/install APIs, progress state, inference process lifecycle.
- `packages/contracts`: model lifecycle and runtime metadata schemas.
- `packages/agent-adapters`: local Gemma adapter.
- `packages/storage`: installed model metadata and active runtime persistence.
- App packaging: local inference sidecar/binary distribution without model weights.

## Goals / Non-Goals

**Goals:**

- Show Gemma 4 E4B as an in-app local model option.
- Let users start model download from the app.
- Download from Google or an approved source without uploading business data.
- Verify the downloaded artifact before marking it installed.
- Store the model in an app-managed local model store.
- Select Local Gemma as a runtime alongside other model runtimes.
- Complete one basic text request through local inference.
- Keep inference fully local after model installation.
- Hide file management, process management, and runtime commands from the user.

**Non-Goals:**

- Preinstalling the model in the app bundle.
- General model marketplace.
- Multiple local model support.
- Fine-tuning or training.
- Multimodal Gemma support.
- Context beyond 124K (V1 targets 124K; see Resolved Decisions).
- Advanced GPU tuning UI.
- User-visible model file management.
- Ollama, LM Studio, OpenAI-compatible local server, or third-party API dependency.
- External local model serving API.

## Decisions

### D1: Download allowed, inference closed

- **Choice:** Allow network access for approved model artifact download, but require inference to stay local and avoid third-party services.
- **Rationale:** The user clarified that model download does not expose company data. The sensitive path is project data entering inference.
- **Alternatives considered:** Ban all internet access. Rejected because it would force manual/offline model distribution and conflict with the desired in-app download.

### D2: V1 targets only Gemma 4 E4B

- **Choice:** Implement one local model entry: Gemma 4 E4B.
- **Rationale:** This proves the full lifecycle without adding provider/model marketplace complexity.
- **Alternatives considered:** Build a flexible model registry for many local models. Rejected for V1 because it expands manifest, compatibility, UI, storage, and testing scope.

### D3: Use Writer-managed private sidecar first

- **Choice:** Package and supervise a Writer-managed local inference sidecar for V1, likely backed by llama.cpp/GGUF-compatible inference.
- **Rationale:** A sidecar is easier to package, restart, observe, and isolate than a native Node addon while still being fully local and invisible to users.
- **Alternatives considered:** Native addon. Deferred because it increases build/distribution complexity. Ollama/LM Studio. Rejected as runtime dependencies. Public localhost server. Rejected because it creates an unnecessary protocol/API surface.

### D4: Integrate through agent run events

- **Choice:** Expose Local Gemma as an agent adapter/runtime that emits normalized text/error/completion events.
- **Rationale:** Existing paste-text and review flows already consume the normalized agent run model.
- **Alternatives considered:** Create a separate local-model chat path. Rejected because it would duplicate orchestration and UI state.

### D5: Store metadata separately from project knowledge

- **Choice:** Store model artifacts in a global app-managed model store and keep project knowledge/index data in project or existing app storage.
- **Rationale:** Model artifacts are large and reusable across projects. Knowledge/index files remain project-related data.
- **Alternatives considered:** Store model under each project folder. Rejected because it duplicates large files and couples model lifecycle to project deletion.

## Risks / Trade-offs

[Resolved] Google source authentication / license acceptance. -> Download from the official Google GGUF repo on Hugging Face using a one-time license click-through plus a stored HF read token (or no token if the repo is ungated), via token-authenticated HTTPS with range-resume and HF-reported sha256. No browser-session scraping or Kaggle credentials required.

[Risk] GGUF/llama.cpp compatibility for Gemma may change quickly. -> Mitigation: pin a tested official Google GGUF artifact, checksum, chat template, and sidecar version.

[Risk] A sidecar could accidentally expose a network listener. -> Mitigation: V1 sidecar must communicate only through daemon-owned child process IPC and must not bind public HTTP ports.

[Risk] GPU backend packaging differs by OS and NVIDIA driver. -> Mitigation: start with a clearly supported target platform and add runtime diagnostics for GPU availability and fallback behavior.

[Risk] Model downloads are large and can fail. -> Mitigation: add resumable/progress-aware download state where feasible and clear retry/delete states.

[Trade-off] V1 avoids multimodal and full 128K context despite Gemma capability. -> Accepted to keep the first local runtime focused on basic text inference.

## Migration Plan

1. Add shared local model lifecycle contracts and local Gemma adapter metadata.
2. Add daemon model manifest, download, verify, install, and status endpoints.
3. Add local model metadata persistence.
4. Package or reference the private inference sidecar for development.
5. Add Local Gemma adapter emitting normalized run events.
6. Add desktop Local Models UI and runtime selection path.
7. Verify download/install with a mocked artifact and verify inference with a local test artifact or real approved model where available.

Rollback strategy: hide the Local Models UI and do not register the Local Gemma adapter. Existing provider runtimes remain unchanged.

Acceptance:

- `npm run typecheck`
- `npm run test`
- `openspec validate add-local-gemma-runtime --type change --strict`
- Manual or mocked evidence for: download -> verify -> install -> select Local Gemma -> complete one basic local text request
- Evidence that inference does not use Ollama, LM Studio, third-party APIs, or public local serving endpoints

## Resolved Decisions (V1)

- **Inference:** V1 must perform a real local Gemma run on actual model weights. A mock runtime may exist only as a dev fallback; it is not the V1 deliverable.
- **Artifact source + format:** Google publishes only safetensors for Gemma 4 E4B (`google/gemma-4-E4B-it`, ungated) — there is no official Google GGUF/QAT for this model. To avoid an in-app conversion step, pin the manifest to **`ggml-org/gemma-4-E4B-it-GGUF`**, the GGUF build maintained by the llama.cpp/ggml team (canonical conversion of Google's weights), file **`gemma-4-E4B-it-Q8_0.gguf`** (~8.03 GB, 8-bit; higher quality than Q4_K_M and comfortable on the 64GB/RTX targets). This repo is **ungated** — no HF token required.
  - Deviation note: this is the llama.cpp team's repo, not the Google HF org. If a strictly Google-origin artifact is a hard requirement, the alternative is `google/gemma-4-E4B-it` safetensors plus an in-app GGUF conversion/quantization step.
- **Download mechanism:** Daemon downloads the single `.gguf` via HTTPS: `GET https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q8_0.gguf`. Use HTTP range requests for resumable progress and the HF-reported sha256 for checksum verification. No auth needed (ungated); keep an optional `Authorization: Bearer <hf-read-token>` hook + WRI-157 secret storage in case the pinned repo ever becomes gated.
- **Platforms:** Package the private inference sidecar for both Windows (NVIDIA/CUDA) and macOS (Metal) in V1.
- **Context length:** 124K is a **supported ceiling, not a V1 optimization target**. Pin a GGUF whose model max >= 124K, but set the runtime default `n_ctx` modest (~8K, sufficient for V1 flows). Large-context memory optimization is out of scope for V1.

## Open Questions / Implications to confirm

- **Capture sha256 at pin time:** When WRI-163 hardcodes the manifest, read the current HF-reported sha256 for `gemma-4-E4B-it-Q8_0.gguf` and commit it as the expected checksum.
