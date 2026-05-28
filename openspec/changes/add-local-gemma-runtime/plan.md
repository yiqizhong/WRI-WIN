# Local Gemma Runtime Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.
>
> Manual note: `superpowers:writing-plans` was not exposed in this session. The user authorized manual artifact creation, so this plan is written directly in the change directory.

**Goal:** Let users download Gemma 4 E4B from inside Writer, install it locally, select Local Gemma, and complete one basic text request without Ollama, LM Studio, or third-party inference APIs.

**Architecture:** The desktop displays model lifecycle state and user actions. The daemon owns download, verification, install, local model metadata, and private inference runtime lifecycle. Local Gemma integrates as an agent adapter that emits normalized run events through the existing runtime flow.

**Tech Stack:** TypeScript, React 19, Electron renderer, daemon HTTP routes, Zod contracts, Vitest, Writer-managed local inference sidecar boundary.

---

## Task 1: Contracts and Storage

- [ ] **Step 1.1:** Read current patterns in `packages/contracts/src/agent.ts`, `packages/contracts/src/connection-diagnostic.ts`, `packages/storage/src/store.ts`, `apps/daemon/src/agents.ts`, `apps/desktop/src/daemon-client.ts`, and `apps/desktop/src/agents-runtime.ts`.
- [ ] **Step 1.2:** Add failing contract tests in `packages/contracts/src/` for local model manifest, model status, progress, verification result, and local runtime metadata schemas.
- [ ] **Step 1.3:** Implement schemas and parsers in a new `packages/contracts/src/local-model.ts` or a locally consistent equivalent; export them from `packages/contracts/src/index.ts`.
- [ ] **Step 1.4:** Add failing storage tests in `packages/storage/src/store.test.ts` for installed model metadata, download state, artifact path, checksum/manifest version, and failed/partial install state.
- [ ] **Step 1.5:** Implement store fields and methods in `packages/storage/src/store.ts`, preserving backward-compatible load defaults for existing store files.
- [ ] **Step 1.6:** Run `npm run test --workspace @writer/contracts` and `npm run test --workspace @writer/storage`.

Commit point: contracts and storage compile and persist local model state.

## Task 2: Daemon Model Lifecycle

- [ ] **Step 2.1:** Add failing daemon tests for model list/status and download lifecycle in `apps/daemon/src/local-models.test.ts` or the closest existing test file.
- [ ] **Step 2.2:** Create a daemon model manifest module such as `apps/daemon/src/local-model-manifest.ts` with the Gemma 4 E4B model id, display name, approved source metadata, artifact identity, and expected checksum placeholder.
- [ ] **Step 2.3:** Implement daemon model list/status handlers and routes in `apps/daemon/src/routes/platform.ts` or a routed module consistent with existing architecture.
- [ ] **Step 2.4:** Add a download manager abstraction in `apps/daemon/src/` that supports progress, failure, retry/reset, and verification states. Use mockable fetch/file operations in tests.
- [ ] **Step 2.5:** Ensure download code never attaches prompts, project files, knowledge content, generated output, or session data to model artifact requests.
- [ ] **Step 2.6:** Add partial-install cleanup/reset behavior so failed downloads do not require manual file management.
- [ ] **Step 2.7:** Run `npm run test --workspace @writer/daemon`.

Commit point: daemon can mock download, verify, install, fail, and reset Gemma 4 E4B model state.

## Task 3: Local Inference Runtime and Adapter

- [ ] **Step 3.1:** Add failing tests in `packages/agent-adapters/src/` for Local Gemma detection before install, detection after install, text streaming, error event, and cancellation.
- [ ] **Step 3.2:** Define a `LocalInferenceRuntime` interface for the sidecar boundary, with methods for availability check, start/reuse, generate text, and cancel.
- [ ] **Step 3.3:** Implement a development/mock runtime that does not call external inference APIs and is replaceable by a packaged sidecar later.
- [ ] **Step 3.4:** Implement a Local Gemma adapter that reports unavailable before install and ready after install/runtime availability.
- [ ] **Step 3.5:** Wire the adapter into the existing registry and daemon filtering so Local Gemma can appear as a runtime option when appropriate.
- [ ] **Step 3.6:** Add cancellation and startup failure handling through existing agent run semantics.
- [ ] **Step 3.7:** Run `npm run test --workspace @writer/agent-adapters` and relevant daemon run tests.

Commit point: Local Gemma adapter can produce normalized local text/error events through a mocked sidecar boundary.

## Task 4: Desktop Local Models UX

- [ ] **Step 4.1:** Add failing desktop tests for local model state formatting and runtime list behavior in `apps/desktop/src/`.
- [ ] **Step 4.2:** Extend `apps/desktop/src/daemon-client.ts` with typed model list/status, download start, retry/reset, and refresh methods.
- [ ] **Step 4.3:** Add a Local Models surface or section in the existing settings/navigation pattern, showing Gemma 4 E4B states: not installed, downloading, verifying, installed, ready, failed, retry.
- [ ] **Step 4.4:** Add progress display and clear action buttons for Download, Retry, and Reset/Delete failed partial install.
- [ ] **Step 4.5:** Show Local Gemma in the runtime selector only when installed and ready, while preserving Cursor, Devin, BYOK, and existing options.
- [ ] **Step 4.6:** Run `npm run test --workspace @writer/desktop`.

Commit point: user can manage Gemma 4 E4B download/install state from the UI and select Local Gemma when ready.

## Task 5: Verification

- [ ] **Step 5.1:** Run `npm run typecheck`.
- [ ] **Step 5.2:** Run `npm run test`.
- [ ] **Step 5.3:** Run `openspec validate add-local-gemma-runtime --type change --strict`.
- [ ] **Step 5.4:** Manually or mock-provider verify download -> verify -> install -> select Local Gemma -> complete one basic local text request.
- [ ] **Step 5.5:** Record evidence in `openspec/changes/add-local-gemma-runtime/verify.md` during the verify phase.

Commit point: all OpenSpec tasks have evidence and the local model V1 path is ready for review.
