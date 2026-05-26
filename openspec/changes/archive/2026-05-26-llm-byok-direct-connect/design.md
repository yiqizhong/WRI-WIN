## Context

WRI-48 delivered CLI adapters (Cursor, Codex, Claude, Devin). Open Design additionally exposes **BYOK**: user supplies OpenAI-compatible credentials and the daemon proxies SSE without spawning a CLI. User confirmed Writer should implement the same “直接连” path.

## Goals / Non-Goals

**Goals:**
- `byok` adapter registered and selectable as active agent.
- `POST /llm/proxy/stream` for raw OpenAI chat completions SSE (review prompts).
- Persist BYOK config locally (`baseUrl`, `apiKey`, `model`, `protocol`).
- Desktop settings tab for API provider with test stream.
- SSRF guard: allow user-configured host + loopback; block arbitrary RFC1918 unless explicitly allowed in v1 loopback-only for safety.

**Non-Goals:**
- Anthropic native Messages API in v1 (OpenAI-compatible only first; Anthropic tab later).
- Storing keys in OS keychain (v1: local JSON store, user-managed machine).
- Tool-use / agentic loops over BYOK (text completion only).

## Decisions

### D1: OpenAI-compatible chat completions for v1

- **选择**: `POST {baseUrl}/chat/completions` with `stream: true`, parse `data: ` SSE lines.
- **理由**: Covers Ollama, LiteLLM, OpenRouter, many gateways.
- **Alternative**: Dual Anthropic + OpenAI — defer to v1.1.

### D2: BYOK as first-class adapter `byok`

- **选择**: `createByokAdapter()` implements same `AgentAdapterImplementation`; `detect()` returns available when config valid.
- **理由**: Reuses `POST /agents/runs` and desktop adapter picker without parallel code paths.

### D3: Execution mode in store

- **选择**: `llmExecutionMode: 'cli' | 'byok'` + `byokConfig` on platform store; active adapter auto-set to `byok` when mode is byok.
- **理由**: Clear product toggle like Open Design BYOK tab.

### D4: SSRF policy (strict v1)

- **选择**: Only `http://127.0.0.1`, `http://localhost`, and `https://` hosts; reject private IP literals except 127.0.0.1; no redirect follow.
- **理由**: Prevent daemon from being used to scan internal network.

## Risks / Trade-offs

- [Risk] API keys in plaintext JSON → Mitigation: document local-only storage; keychain later.
- [Trade-off] No Anthropic protocol in v1 → document OpenAI-compatible gateways for Claude.

## Migration Plan

- Ship behind default `cli` mode; existing users unchanged.
- README section “Direct API (BYOK)”.

## Open Questions

- Per-project vs global BYOK config — v1 global only.
