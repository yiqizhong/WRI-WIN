## Why

The current app has local CLI adapter and Figma MCP scaffolding, but users still cannot reliably tell whether a provider or MCP server is truly connected, authenticated, and usable. This change turns connection setup into a diagnosable workflow before deeper Figma extraction and writeback work depends on it.

## What Changes

**Local CLI LLM provider diagnostics**
- From: adapters mostly expose `available` plus a setup string.
- To: adapters expose structured diagnostics for missing command, broken binary wrapper, failed version probe, missing auth, timeout, smoke failure, and ready states.
- Reason: users need actionable setup guidance, especially when a CLI exists on PATH but cannot run.
- Impact: non-breaking contract extension; desktop can show richer connection state.

**CLI smoke results**
- From: `/agents/smoke` returns a simple `ok/message/output` shape.
- To: smoke returns structured provider status, diagnostic code, command metadata, and bounded output/error snippets.
- Reason: desktop and manual verification need machine-readable failure causes.
- Impact: additive API fields.

**Figma MCP runtime**
- From: Figma MCP smoke is a token/dry-run bootstrap payload.
- To: daemon can start a configured Figma MCP server, initialize a client session, list tools, and run a read smoke through MCP.
- Reason: Figma MCP is a critical integration and must prove real connectivity.
- Impact: daemon gains an MCP client dependency and config surface.

**Desktop connection panel**
- From: Agents panel shows provider availability and an MCP toggle.
- To: Agents/MCP panel shows diagnostics, discovered Figma MCP tools, and test actions for both provider smoke and Figma read smoke.
- Reason: users should repair connection problems from the app without reading logs first.
- Impact: desktop UI enhancement.

## Capabilities

### New Capabilities

- `connection-diagnostics`: Shared diagnostic codes, messages, and recovery actions for local runtime connections.

### Modified Capabilities

- `agent-llm-providers`: Provider detection and smoke testing gain structured diagnostic behavior.
- `agent-adapter-runtime`: Agent adapter metadata includes diagnostics used by daemon and desktop workflows.
- `tool-mcp-runtime`: Figma MCP server management becomes a real client lifecycle with tool discovery and read smoke.

## Impact

- `packages/contracts` — connection diagnostic schema; agent and MCP schema extensions.
- `packages/agent-adapters` — CLI runner error classification; structured detect/smoke output.
- `apps/daemon` — Figma MCP config/client lifecycle, read smoke, richer MCP status.
- `apps/desktop` — Agents/MCP panel diagnostics and Figma read smoke action.
- `README.md` — local CLI and Figma MCP setup/verification instructions.
- `docs/linear-openspec-map.md` — new OpenSpec ↔ Linear mapping.
- Dependency impact: likely add `@modelcontextprotocol/sdk` to the daemon workspace.
