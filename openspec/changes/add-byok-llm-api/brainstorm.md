Manual brainstorm capture for `add-byok-llm-api`

Note: The `superpowers-bridge` brainstorm PRECHECK requires `superpowers:brainstorming`.
This session did not expose that skill as callable. The user explicitly authorized
manual brainstorm creation on 2026-05-27 after the PRECHECK was reported.

## Background

The current system supports Cursor and Devin as model execution paths. The requested
change is to add a first version of user-provided LLM API access so users can paste
an API key and run the program without installing or configuring another external
agent.

The original exploration considered Google API as a concrete example, but the user
clarified that Google should not be treated as the product boundary. The product
boundary is user-controlled API access from providers such as DeepSeek, Google, or
other compatible providers. For V1, the user then reduced the scope to two outcomes:

1. Implement paste functionality.
2. Make the program run end to end.

## Design Direction

The smallest useful product is not a full provider marketplace. It is a minimal
Bring Your Own Key path:

- Add a user-facing entry point to paste an API key.
- Bind that key to one supported provider preset for V1.
- Validate the key with a minimal request.
- Persist enough local configuration for the runtime to reuse it.
- Route a basic text generation request through the existing execution flow.

Deep provider abstraction, model discovery, advanced headers, multi-key management,
cost tracking, fallback routing, and full tool/multimodal compatibility are out of
scope for this first slice.

## Decision Chain

### Q1: Should V1 support many providers?

Decision: No. V1 should support one provider preset plus code structure that does
not prevent later provider expansion.

Reasoning: The acceptance criteria are paste and run. Supporting many providers
would move effort into edge cases, error normalization, and incompatible streaming
formats before the core experience is proven.

### Q2: Should V1 expose base URL and model configuration?

Decision: Avoid exposing advanced configuration in the primary flow. Use provider
defaults for V1. If implementation needs a model value, store it internally or use
a simple default.

Reasoning: The user explicitly wants to avoid extra operations. Asking users to
understand endpoints, compatibility modes, and model names conflicts with the V1
goal.

### Q3: Should the API runtime be equivalent to Cursor and Devin immediately?

Decision: No. It only needs to complete a basic model request in the existing flow.

Reasoning: Cursor and Devin are agent-style integrations. BYOK API V1 can be a
minimal text generation runtime first, then grow tool use and richer agent behavior
in later changes.

### Q4: How should failure behave?

Decision: Show a plain failure state and keep the user in the setup flow.

Reasoning: V1 does not need a comprehensive error taxonomy, but it must not fail
silently. Basic cases include invalid key, network failure, and provider/model
unavailable.

## Proposed V1 Shape

User flow:

```text
Settings / Runtime
  -> Add API Key
  -> Paste API Key
  -> Test
  -> Save
  -> Select API runtime
  -> Run a basic request
```

Runtime shape:

```text
Existing runtime picker
  - Cursor
  - Devin
  - User API (V1)
      - provider preset: one selected implementation
      - api key: secret value
      - test connection
      - generate text
```

## V1 Acceptance

The V1 change is complete when:

- A user can paste an API key through the app UI.
- The app can save or hold that key in the expected local runtime configuration.
- The app can test the connection or otherwise make a minimal authenticated request.
- The app can run a basic model request using that pasted API key.
- Failure shows a visible error instead of silently breaking.

## Out of Scope

- Multiple provider management.
- Provider marketplace.
- Automatic model listing.
- Custom base URL UI.
- Custom headers.
- Cost tracking.
- Multi-key accounts.
- Team/shared credentials.
- Automatic fallback routing.
- Full tool calling parity with Cursor or Devin.
- Multimodal support.
- Comprehensive streaming normalization across providers.
