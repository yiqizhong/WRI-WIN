## Why

Writer already supports local agent CLIs (WRI-48), but Open Design also offers a BYOK path: any OpenAI-compatible endpoint with no CLI install. Designers and PMs often have API keys or local Ollama/LiteLLM gateways and expect one-step “direct connect” without smoke-testing four separate binaries. Adding BYOK parity closes the gap between our architecture spec and Open Design’s dual execution model.

## What Changes

**Direct API execution**
- From: review prompts only via spawned CLIs.
- To: daemon can stream chat completions from user-configured OpenAI-compatible `baseUrl` + `apiKey` + `model`.
- Reason: Match Open Design direct connect UX.
- Impact: New `byok` adapter and optional active execution mode.

**Proxy endpoint**
- From: no HTTP LLM proxy.
- To: `POST /llm/proxy/stream` forwards SSE chunks with loopback/SSRF guards.
- Reason: Centralize network egress in daemon; renderer never holds keys.

**Settings persistence**
- From: no stored API provider config.
- To: per-project or global BYOK settings in local store (v1: global in platform store JSON).
- Reason: User should not re-paste keys every session.

**Desktop UX**
- From: Agents panel lists CLIs only.
- To: “API provider (BYOK)” tab with baseUrl, apiKey, model, test stream, execution mode toggle.
- Reason: Visible parity with Open Design settings.

## Capabilities

### New Capabilities
- `llm-byok-proxy`: OpenAI-compatible streaming proxy, config CRUD, SSRF policy, BYOK adapter integration.

### Modified Capabilities
- `agent-adapter-runtime`: Support `byok` adapter and execution mode selection alongside CLI adapters.

## Impact

- `packages/contracts`, `packages/storage`, new `packages/llm-proxy` (or `agent-adapters/byok`)
- `apps/daemon` routes and agent run dispatch
- `apps/desktop` settings UI
- `docs/linear-openspec-map.md`
