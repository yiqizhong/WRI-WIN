## Context

Writer is a local-first desktop app with a renderer, a privileged daemon, shared contracts, local storage, and agent adapters. Current user-facing provider execution is centered on local provider adapters such as Cursor and Devin. There is already a `llm-byok-proxy` capability describing BYOK config, proxy streaming, SSRF protection, and a `byok` adapter, but this change narrows the implementation target to the first user-visible slice: paste an API key and run one basic request.

The key architectural boundary remains unchanged: the renderer collects user input and displays status, while the daemon validates requests, persists settings, runs provider tests, and executes model calls. API keys must not be handled as project artifacts or logged output.

Affected areas:

- `apps/desktop`: runtime settings UI and daemon client calls.
- `apps/daemon`: BYOK config, connection test, and agent run integration.
- `packages/contracts`: typed request/response schemas.
- `packages/agent-adapters`: `byok` adapter implementation or registration.
- `packages/storage`: local config persistence and redaction behavior.

## Goals / Non-Goals

**Goals:**

- Let a user paste an API key into the app.
- Validate the key with one supported provider preset.
- Save enough local configuration to reuse the provider.
- Make the BYOK runtime selectable alongside Cursor and Devin.
- Complete a basic text model request through the existing agent run path.
- Show visible failure for invalid key, network failure, or unavailable provider response.

**Non-Goals:**

- Multiple provider management.
- Provider marketplace.
- Automatic model listing.
- Custom base URL or custom header UI.
- Cost accounting.
- Team/shared secrets.
- Automatic fallback routing.
- Full tool calling parity with local CLI agents.
- Multimodal support.
- Comprehensive provider compatibility across Google, DeepSeek, OpenRouter, Azure, and arbitrary custom endpoints.

## Decisions

### D1: Ship one preset first

- **Choice:** V1 implements one provider preset and hides base URL/model/protocol complexity behind defaults.
- **Rationale:** The explicit acceptance criteria are paste and run. One preset is enough to prove the full path through UI, daemon, storage, adapter selection, and model execution.
- **Alternative considered:** Build a generic provider setup with Google, DeepSeek, OpenAI-compatible, and custom endpoints. Rejected because it would move the slice into provider matrix work before validating the core experience.

### D2: Reuse the agent adapter runtime

- **Choice:** Implement the BYOK path as an adapter selectable by the existing agent runtime rather than creating a separate chat execution path.
- **Rationale:** Paste text chat and review flows already expect normalized agent run events. Reusing that path keeps Cursor, Devin, and BYOK under one runtime selection model.
- **Alternative considered:** Call the BYOK endpoint directly from the chat UI. Rejected because the renderer must not own execution or secret-handling behavior.

### D3: Keep secrets daemon-owned

- **Choice:** The renderer may submit the pasted key, but storage, testing, and runtime use are daemon-owned. UI and logs only receive redacted metadata.
- **Rationale:** This preserves the desktop/daemon boundary and reduces the chance of leaking API keys through project files, UI state dumps, or logs.
- **Alternative considered:** Store the key in renderer state or local browser storage for speed. Rejected because it weakens the local security boundary.

### D4: Basic request before full streaming parity

- **Choice:** V1 only needs to complete a basic text generation request and emit normalized text/error events sufficient for the existing flow.
- **Rationale:** Tool calls, multimodal inputs, and cross-provider streaming edge cases are later work. The first slice should end once the program runs with a pasted key.
- **Alternative considered:** Normalize all provider features now. Rejected as unnecessary for the requested first version.

## Risks / Trade-offs

[Risk] The selected provider preset may still require model or endpoint details in some accounts. -> Mitigation: choose the easiest preset available in the current implementation context and provide a clear error if the default model is unavailable.

[Risk] Persisting API keys in the existing store may expose secrets if storage is inspected. -> Mitigation: use the safest existing local storage pattern available in this repo for secrets and always redact returned config, diagnostics, and logs.

[Risk] A minimal BYOK adapter may not match CLI agent capabilities. -> Mitigation: mark it as a basic provider runtime in metadata and keep tool/multimodal parity out of scope.

[Trade-off] Hiding advanced configuration limits provider flexibility in V1. -> Accepted because the user asked for the simplest paste-and-run slice.

## Migration Plan

1. Add the minimal contract and storage shape behind existing daemon APIs or small new BYOK-specific endpoints.
2. Add the BYOK adapter registration without removing Cursor or Devin.
3. Add the paste/test/save UI in the existing runtime settings surface.
4. Verify the provider test path and one basic run path.
5. Rollback strategy: remove the BYOK adapter from registration and hide the UI affordance; existing Cursor and Devin behavior remains unchanged.

Acceptance:

- `npm run typecheck`
- `npm run test`
- `openspec validate add-byok-llm-api --type change --strict`
- Manual evidence that a pasted key can be tested and used for one basic model request, or a mocked provider proves the same path if no live key is available.

## Open Questions

- Which provider preset should be used for V1 implementation depends on the lowest-friction endpoint available during implementation. The product requirement allows Google, DeepSeek, or another provider, but V1 should pick only one.
- Whether the existing local store already has an acceptable secret pattern must be confirmed during implementation.
