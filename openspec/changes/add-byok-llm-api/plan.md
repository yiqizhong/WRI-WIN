# Minimal BYOK LLM API Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.
>
> Manual note: `superpowers:writing-plans` was not exposed in this session. The user authorized manual artifact creation, so this plan is written directly in the change directory.

**Goal:** Let a user paste one supported provider API key, test it, save/select it, and complete one basic model request through the existing Writer runtime.

**Architecture:** Keep execution daemon-owned. The desktop only collects the key and displays state; the daemon validates and stores config, and `packages/agent-adapters` exposes a `byok` adapter that emits the same normalized run events as Cursor and Devin. V1 supports one preset and intentionally avoids custom endpoint/model UI.

**Tech Stack:** TypeScript, React 19, Electron renderer, daemon HTTP routes, Zod contracts, Vitest.

---

## Task 1: Runtime Contract and Store

- [ ] **Step 1.1:** Read the current BYOK-related code and tests before editing: `openspec/specs/llm-byok-proxy/spec.md`, `packages/contracts/src/agent.ts`, `apps/daemon/src/agents.ts`, `packages/storage/src/store.ts`, `apps/desktop/src/agents-runtime.ts`, and `apps/desktop/src/agents-panel.tsx`.
- [ ] **Step 1.2:** Add failing contract tests in `packages/contracts/src/agent.test.ts` for accepting a `byok` LLM provider adapter and a non-local runtime kind if needed.
- [ ] **Step 1.3:** Update `packages/contracts/src/agent.ts` so `LLM_PROVIDER_ADAPTER_IDS` includes `byok` and the runtime metadata can represent the API-backed provider without weakening existing Cursor/Devin parsing.
- [ ] **Step 1.4:** Add failing storage tests in `packages/storage/src/store.test.ts` for saving, loading, and redacting minimal BYOK config. Cover the existing migration path that currently drops stale `activeAdapterId: "byok"`.
- [ ] **Step 1.5:** Add minimal store methods in `packages/storage/src/store.ts`, such as `getLlmByokConfig`, `setLlmByokConfig`, and a redacted getter. Keep raw key out of returned runtime metadata.
- [ ] **Step 1.6:** Run `npm run test --workspace @writer/contracts` and `npm run test --workspace @writer/storage`.

Commit point: Tasks 1.2-1.6 complete and tests pass.

## Task 2: Daemon Test and BYOK Adapter

- [ ] **Step 2.1:** Add failing daemon tests around the intended BYOK setup route in `apps/daemon/src/agents.test.ts` or a focused BYOK daemon test file. Cover empty key rejection, invalid provider response, redaction, and successful save.
- [ ] **Step 2.2:** Add a daemon-owned provider preset module under `apps/daemon/src/` or `packages/agent-adapters/src/` depending on existing ownership after inspection. It should expose fixed V1 defaults and a minimal request builder.
- [ ] **Step 2.3:** Add a route in `apps/daemon/src/routes/platform.ts` for testing/saving BYOK config, or extend existing agent routes if a suitable path already exists. Validate all payloads with shared schemas.
- [ ] **Step 2.4:** Add failing adapter tests in `packages/agent-adapters/src/` for `byok` detection and a successful mocked text run.
- [ ] **Step 2.5:** Implement `packages/agent-adapters/src/byok-adapter.ts` or equivalent so the adapter reports unavailable without saved config, available with saved config, and emits normalized `text`/`error` events for a basic request.
- [ ] **Step 2.6:** Register the `byok` adapter in `packages/agent-adapters/src/index.ts` and update daemon adapter filtering so `/agents` includes Cursor, Devin, and BYOK only.
- [ ] **Step 2.7:** Run `npm run test --workspace @writer/agent-adapters` and `npm run test --workspace @writer/daemon`.

Commit point: BYOK can be tested/saved and the daemon can run a mocked basic request.

## Task 3: Desktop Paste-Key UI

- [ ] **Step 3.1:** Add failing desktop tests in `apps/desktop/src/agents-runtime.test.ts` showing the provider list preserves Cursor, Devin, and BYOK placeholders.
- [ ] **Step 3.2:** Update `apps/desktop/src/agents-runtime.ts` to include a `byok` placeholder and stable display name, for example `API Key`.
- [ ] **Step 3.3:** Extend `apps/desktop/src/daemon-client.ts` with typed methods for BYOK test/save if the daemon adds new endpoints.
- [ ] **Step 3.4:** Add paste-key UI inside `apps/desktop/src/agents-panel.tsx` near the LLM provider list. Keep the primary path to one API key input plus Test/Save actions; do not expose base URL/model fields in V1.
- [ ] **Step 3.5:** Show empty-key validation locally and show daemon success/failure results. Make the saved BYOK adapter selectable with the existing `setActiveLlmAdapter` flow.
- [ ] **Step 3.6:** Run `npm run test --workspace @writer/desktop`.

Commit point: User can paste, test/save, and select the API runtime from the desktop settings surface.

## Task 4: End-to-End Verification

- [ ] **Step 4.1:** Run full checks: `npm run typecheck`, `npm run test`, and `openspec validate add-byok-llm-api --type change --strict`.
- [ ] **Step 4.2:** Start the app locally using the repo's existing dev flow and verify the settings UI shows Cursor, Devin, and API Key.
- [ ] **Step 4.3:** Verify empty API key is rejected before daemon save.
- [ ] **Step 4.4:** Verify a mocked provider or live provider key can be tested, saved, selected, and used for one basic paste-text chat or agent run request.
- [ ] **Step 4.5:** Record verification evidence in `openspec/changes/add-byok-llm-api/verify.md` during the verify phase, then check off `tasks.md` items only when corresponding evidence exists.

Commit point: All OpenSpec tasks complete and V1 acceptance is demonstrated.
