## 1. Contracts and Storage

- [ ] 1.1 Inspect current agent adapter, daemon route, storage, and desktop settings patterns before adding local model code.
- [ ] 1.2 Add shared contracts for local model manifest, download/install status, progress, verification result, and local model runtime metadata.
- [ ] 1.3 Add storage for installed model metadata, download state, artifact path, checksum/manifest version, and active Local Gemma readiness.

## 2. Daemon Model Lifecycle

- [ ] 2.1 Add a daemon-owned Gemma 4 E4B model manifest with approved download source, expected artifact identity, and verification metadata.
- [ ] 2.2 Implement model status, download start, progress, retry/failure, verify, and install operations behind daemon APIs.
- [ ] 2.3 Ensure model download requests do not include project files, prompts, knowledge content, generated output, or other business data.
- [ ] 2.4 Add deletion or reset behavior for failed/partial installs so users can recover without managing files manually.

## 3. Local Inference Runtime

- [ ] 3.1 Add a Writer-managed private inference runtime boundary for development, using a sidecar abstraction that does not expose a public local API.
- [ ] 3.2 Implement Local Gemma adapter detection: unavailable before install, ready after install and runtime availability.
- [ ] 3.3 Implement a basic text run through the local runtime that emits normalized text/error/completion events.
- [ ] 3.4 Implement cancellation and runtime startup failure handling through existing agent run semantics.

## 4. Desktop Local Models UX

- [ ] 4.1 Add a Local Models UI entry for Gemma 4 E4B with not-installed, downloading, verifying, installed, ready, failed, and retry states.
- [ ] 4.2 Wire desktop daemon-client methods for model list/status, download start, progress refresh, retry/reset, and active runtime selection.
- [ ] 4.3 Show Local Gemma as a selectable runtime only when installed and ready, without removing existing runtimes.

## 5. Verification

- [ ] 5.1 Add unit tests for model contracts, storage persistence, manifest validation, verification failure, and download state transitions.
- [ ] 5.2 Add daemon tests for mocked download/install and local runtime success/failure without third-party inference calls.
- [ ] 5.3 Add desktop tests for Local Models state rendering and runtime selection behavior where existing harnesses support it.
- [ ] 5.4 Run `npm run typecheck`, `npm run test`, and `openspec validate add-local-gemma-runtime --type change --strict`.
- [ ] 5.5 Manually or mock-provider verify download -> verify -> install -> select Local Gemma -> complete one basic local text request.
