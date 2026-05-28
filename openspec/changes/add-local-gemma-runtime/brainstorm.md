Manual brainstorm capture for `add-local-gemma-runtime`

Note: The `superpowers-bridge` brainstorm PRECHECK requires `superpowers:brainstorming`.
This session did not expose that skill as callable. The user explicitly authorized
manual brainstorm creation after the PRECHECK was reported.

## Background

Writer currently depends on external/local provider adapters for model execution.
The requested change is a new local model capability: Writer should independently
download and run Google Gemma 4 E4B inside the app-managed local environment.

The user clarified the privacy/security boundary:

1. It is acceptable for Writer to read and process company/project data because the
   app is an internal company tool.
2. The core privacy requirement is that business data, prompts, project knowledge,
   model inputs, and outputs must not be sent to third-party inference providers.
3. Downloading the model from Google is acceptable because the download stage does
   not expose company data.
4. After the model is downloaded, inference must run locally without relying on
   third-party APIs, Ollama, LM Studio, or an externally installed runtime.

The user's target hardware is strong enough for this scope: high-end NVIDIA RTX
workstations, 64GB RAM, and 1TB storage. Performance remains a product concern,
but the first slice should not be constrained around low-end hardware.

## Research Snapshot

Public references indicate that Gemma 4 E4B is available from Google/Hugging Face,
is runnable locally through Ollama, and has GGUF artifacts suitable for llama.cpp-
style local inference. Ollama is useful as implementation reference, but must not
become a runtime dependency. Writer should own the download, storage, process
lifecycle, logging, and network boundaries.

Relevant public references gathered during exploration:

- `google/gemma-4-E4B` on Hugging Face.
- `ggml-org/gemma-4-E4B-it-GGUF` for GGUF local inference artifacts.
- Ollama `gemma4:e4b` as proof that Gemma 4 E4B can be packaged for local use.
- `llama.cpp` as a local inference engine family that can run GGUF models.

## Design Direction

The first version should be an enterprise local model runtime, not a general model
marketplace.

V1 user flow:

```text
Settings / Local Models
  -> Gemma 4 E4B
  -> Download
  -> Download progress
  -> Verify artifact
  -> Install locally
  -> Select Local Gemma runtime
  -> Run a basic text request
```

Runtime shape:

```text
Desktop UI
  -> daemon model download/install APIs
  -> daemon agent runtime selection APIs

Daemon
  -> approved model manifest
  -> download manager
  -> checksum/signature verification
  -> local model store
  -> private inference sidecar or embedded libllama runtime
  -> local-gemma adapter emitting normalized agent run events
```

## Decision Chain

### Q1: Should Writer depend on Ollama?

Decision: No. Ollama can be studied as proof and reference, but Writer must not
require Ollama installation, Ollama daemon, Ollama API, LM Studio, or any external
runtime service.

Reasoning: The user wants a fully integrated app experience. All background file
management and inference lifecycle must be app-managed and invisible to the user.

### Q2: Can the app download from Google?

Decision: Yes. Downloading the model from Google or a Google-approved source is
allowed because no company data is sent during model acquisition.

Reasoning: The security boundary is not "never connect to the internet." It is
"do not send business data to third-party inference or processing services."

### Q3: What should be prohibited after install?

Decision: Runtime inference must not call third-party APIs, telemetry endpoints,
or external inference services. Prompt, project knowledge, source documents, model
inputs, generated output, and local indexes stay within Writer's local environment.

Reasoning: This preserves the internal closed loop while still allowing model
acquisition from an approved public source.

### Q4: Should V1 include a full model marketplace?

Decision: No. V1 should expose one model: Gemma 4 E4B.

Reasoning: The user asked for a specific local model. The first slice should prove
download, verify, install, select, and run before expanding to multiple models.

### Q5: Native addon or sidecar?

Decision: Prefer a Writer-managed private sidecar for V1, with an interface that
can later be replaced by a native addon if needed.

Reasoning: A sidecar is easier to package, supervise, test, restart, and isolate
than a native Node addon. It can still be fully local and invisible to the user.
It must not expose a public localhost API; use daemon-owned child process IPC
such as stdin/stdout or private OS pipes.

## V1 Acceptance

The first version is complete when:

- The app shows a local model entry for Gemma 4 E4B.
- The user can click Download from inside the app.
- The daemon downloads the approved model artifact from Google or another approved
  source without exposing business data.
- The daemon verifies and installs the model into a local model store.
- The app shows download, install, ready, and failure states.
- The local Gemma runtime can be selected alongside existing model runtimes.
- The daemon completes one basic text request using the local model after install.
- Disconnecting the network after installation does not prevent local inference.
- The runtime path does not call third-party inference APIs, Ollama, LM Studio, or
  other external services.

## Out of Scope

- Full model marketplace.
- Multiple local models.
- Fine-tuning.
- Training.
- Tool calling parity.
- Multimodal Gemma 4 support.
- Full 128K context productization.
- Corporate mirror management UI.
- Advanced GPU tuning UI.
- User-visible model file management.
- External APIs for local model serving.
