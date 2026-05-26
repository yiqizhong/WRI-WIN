## ADDED Requirements

### Requirement: BYOK config persistence

The platform store SHALL persist `llmExecutionMode` (`cli` | `byok`) and optional `llmByokConfig` (`baseUrl`, `apiKey`, `model`, `protocol`).

#### Scenario: Save and reload settings

- **WHEN** the daemon saves LLM settings via `PUT /llm/config`
- **THEN** a subsequent `GET /llm/config` returns the same execution mode and BYOK fields

### Requirement: OpenAI-compatible proxy stream

The daemon SHALL expose `POST /llm/proxy/stream` that forwards SSE chat completion chunks from an OpenAI-compatible upstream.

#### Scenario: Stream with stored config

- **WHEN** the client posts messages with `useStoredConfig: true` and valid stored BYOK config
- **THEN** the response is `text/event-stream` with `data:` lines containing upstream deltas

### Requirement: SSRF guard on base URL

The proxy SHALL reject private-network base URLs except loopback (`127.0.0.1`, `localhost`).

#### Scenario: Block private LAN IP

- **WHEN** base URL host is `192.168.1.1`
- **THEN** validation fails before any outbound request

### Requirement: BYOK agent adapter

A `byok` adapter SHALL implement the same `detect` / `run` contract as CLI adapters and be selectable as active when execution mode is `byok`.

#### Scenario: Run review via BYOK

- **WHEN** execution mode is `byok` and config is valid
- **THEN** `POST /agents/runs` streams text events from the configured upstream without spawning a CLI
