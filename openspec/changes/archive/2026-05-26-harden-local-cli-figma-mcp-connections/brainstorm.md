# Brainstorm: Harden local CLI LLM and Figma MCP connections

## Context

The user stated the primary goal: make local CLI LLM connections work well, and make Figma MCP work well.

Current project state:

- Local CLI adapters already exist for `claude-code`, `codex`, `cursor-agent`, and `devin`.
- Desktop has an Agents panel with refresh, test connection, and active adapter controls.
- Daemon has `/agents`, `/agents/detect`, `/agents/smoke`, and `/agents/runs`.
- Figma MCP currently has a server toggle plus bootstrap smoke endpoints, but the implementation uses `FIGMA_ACCESS_TOKEN` checks and dry-run metadata rather than a real MCP client lifecycle.
- On this machine, `claude`, `cursor`, and `devin` version probes work. `codex` is on PATH but fails with an `ENOENT` vendor binary error.
- Linear shows the previous broad milestones as Done, but the observed runtime connection quality is not yet production-grade.

## Decision Chain

### Q1: Should this be treated as a bugfix or a new change?

Decision: create a new OpenSpec change using `superpowers-bridge`.

Reasoning: this changes product behavior and contracts around connection diagnosis, MCP runtime, and user-visible setup flows. It is more than a trivial fix.

### Q2: What is the narrow goal?

Decision: connection-first hardening.

In scope:

- Reliable local CLI LLM detection, diagnostics, smoke testing, and desktop feedback.
- Codex broken-install diagnosis when wrapper exists but vendor binary is missing.
- Structured smoke result payloads for CLI providers.
- Real daemon-owned Figma MCP client lifecycle with configurable command/args/env.
- Figma MCP tool listing and read smoke through MCP.
- Desktop controls/status that show connection state and actionable recovery messages.

Out of scope:

- BYOK/direct LLM API paths.
- Full Figma text extraction replacement through MCP.
- Full Figma writeback implementation beyond gated smoke behavior.
- Reworking the audit/rewrite engine.

### Q3: Which approach?

Considered approaches:

1. Patch only the obvious failures.
   - Pros: fastest.
   - Cons: keeps Figma MCP as a bootstrap stub and leaves users guessing on connection state.

2. Connection-first hardening across both runtime surfaces.
   - Pros: gives users clear, testable connection flows before deeper review/writeback work.
   - Cons: requires new MCP runtime code and additional contracts/tests.

3. Full Figma workflow integration now.
   - Pros: moves directly toward end-to-end product workflow.
   - Cons: too broad; extraction/writeback correctness depends on first having reliable MCP connectivity.

Chosen: option 2.

## Proposed Design

### Local CLI LLM

Keep all CLI process execution in `packages/agent-adapters`. Extend detection from a boolean into a diagnostic result that separates:

- command missing
- wrapper/binary broken
- version probe failed
- auth missing
- smoke failed
- ready

Expose this through existing adapter metadata and structured smoke responses. Desktop should display status, version/path where available, and next-step recovery text.

### Figma MCP

Add a daemon-owned MCP client layer. It should:

- build Figma MCP config from env and persisted server settings
- start/stop a stdio MCP client for the configured Figma server
- run `initialize`/tool discovery through the MCP protocol
- expose connection status and tool list through `/mcp/servers`
- run a read smoke by calling a configured/read-capable Figma MCP tool when possible

Default config should be explicit and recoverable. If no MCP command is configured, the UI should say exactly what to set instead of pretending to be connected.

### Desktop

Keep a single "Agents and MCP" settings surface, but make it more useful:

- show CLI provider diagnostics instead of just available/unavailable
- show Figma MCP status, error, and discovered tools
- add "Test Figma read" action
- keep destructive write behavior behind daemon permission gates

## Risks

- MCP server command/tool names vary by Figma MCP implementation.
  - Mitigation: make command/args/tool names configurable and surface discovered tools.

- CLI smoke commands may launch interactive/auth flows.
  - Mitigation: keep timeouts bounded and classify auth/timeout failures.

- Codex local install can be partially broken even when `which codex` succeeds.
  - Mitigation: explicitly detect wrapper-found-but-vendor-missing `ENOENT` and show reinstall guidance.

## Acceptance Criteria

- `npm run typecheck` passes.
- `npm run test` passes.
- `codex` broken vendor binary is reported as a structured diagnostic instead of a generic unavailable state.
- `/agents/smoke` returns structured provider smoke results suitable for desktop display.
- `/mcp/servers` shows Figma MCP command/config/status/tool discovery state.
- Figma read smoke distinguishes not configured, connection failure, auth/tool failure, and success.
- Desktop Agents/MCP panel exposes both CLI and Figma MCP connection test results with actionable messages.
