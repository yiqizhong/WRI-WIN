## 1. Runtime Contract and Storage

- [ ] 1.1 Inspect existing `llm-byok-proxy`, agent adapter, daemon route, and storage code to identify reusable BYOK pieces before adding new code.
- [ ] 1.2 Add or complete shared contract schemas for minimal BYOK config, redacted config metadata, connection test request/response, and active runtime selection.
- [ ] 1.3 Add or complete local persistence for the V1 BYOK provider preset and pasted API key, ensuring daemon responses and diagnostics redact the raw key.

## 2. Daemon Provider Test and Run Path

- [ ] 2.1 Implement the supported V1 provider preset defaults in daemon-owned code, including default endpoint/model/protocol values.
- [ ] 2.2 Implement a daemon connection test that sends a minimal authenticated request and returns structured success/failure without exposing the key.
- [ ] 2.3 Add or complete the `byok` agent adapter so a saved BYOK config can emit normalized text/error run events through the existing agent run flow.

## 3. Desktop Paste-Key Setup

- [ ] 3.1 Add the minimal paste-key UI to the existing model/runtime settings surface with empty-key validation.
- [ ] 3.2 Wire desktop daemon-client calls for test, save, refresh, and active runtime selection.
- [ ] 3.3 Show ready/error states for BYOK without removing existing Cursor or Devin options.

## 4. Verification

- [ ] 4.1 Add focused unit tests for redaction, config validation, connection test behavior, adapter availability, and normalized BYOK run events.
- [ ] 4.2 Add desktop tests for paste-key validation and runtime list behavior where the existing test harness supports it.
- [ ] 4.3 Run `npm run typecheck`, `npm run test`, and `openspec validate add-byok-llm-api --type change --strict`.
- [ ] 4.4 Manually verify or mock-provider verify that a pasted key can be tested, saved, selected, and used for one basic model request.
