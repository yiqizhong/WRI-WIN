## Context

Writer already has the first pass of local agent adapters and MCP settings, but the current runtime behavior is still closer to a scaffold than a reliable user-facing connection workflow.

Local CLI state:

- `packages/agent-adapters` owns CLI process spawning for Claude Code, Codex, Cursor Agent, and Devin.
- The daemon exposes `/agents`, `/agents/detect`, `/agents/smoke`, and `/agents/runs`.
- The desktop Agents panel can refresh detection, smoke test, and choose an active adapter.
- On the maintainer machine, `claude`, `cursor`, and `devin` version probes work; `codex` exists on PATH but fails because its vendor binary is missing (`ENOENT`).

Figma MCP state:

- `apps/daemon/src/mcp.ts` exposes a Figma server toggle and smoke endpoints.
- The current Figma smoke path checks `FIGMA_ACCESS_TOKEN` and returns bootstrap metadata, but it does not start a real MCP client, initialize a server, list tools, or call a Figma MCP tool.
- The desktop only shows an MCP checkbox, not discovered tools, connection errors, or a read smoke action.

Constraints:

- Renderer code must not launch CLIs, manage MCP processes, mutate Figma, or make destructive permission decisions.
- The daemon remains the privileged boundary for all process execution, MCP lifecycle, and write permission gates.
- Write smoke/writeback must stay gated by approved change IDs and permission requests.

## Goals / Non-Goals

**Goals:**

- Make local CLI provider detection actionable, not just boolean.
- Classify common CLI connection failures: missing command, broken wrapper/vendor binary, version probe failure, missing auth, timeout, smoke failure, and ready.
- Return structured smoke results suitable for both API users and the desktop UI.
- Add a real daemon-owned Figma MCP client lifecycle with configurable command, args, env, initialization, tool discovery, and read smoke.
- Update desktop settings so users can diagnose and test both LLM provider connections and Figma MCP from one surface.
- Preserve existing daemon/desktop/package boundaries and existing public endpoints where possible.

**Non-Goals:**

- No BYOK/direct LLM API work.
- No full Figma extraction rewrite in this change.
- No full text replacement/comment writeback implementation beyond existing gated smoke behavior.
- No audit/rewrite engine redesign.
- No renderer-side MCP or CLI process management.

## Decisions

### D1: Introduce structured connection diagnostics

- **Choice**: Add a shared connection diagnostic shape to `@writer/contracts` and attach diagnostics to agent adapters and MCP server status.
- **Reason**: The desktop and API need the same vocabulary for "installed but broken", "not authenticated", "timed out", and "ready".
- **Alternatives considered**:
  - Keep using `available` plus `setupMessage`: rejected because it hides root cause and forces string parsing in the UI.
  - Separate diagnostics per subsystem: rejected because CLI and MCP have similar connection states and recovery text needs.

### D2: Keep CLI process handling inside `packages/agent-adapters`

- **Choice**: Extend `cli-runner` and `create-cli-adapter` instead of moving detection into the daemon.
- **Reason**: Adapter-specific command behavior already lives there, and the daemon should consume normalized adapter results.
- **Alternatives considered**:
  - Let the daemon probe every CLI directly: rejected because it duplicates adapter knowledge and weakens provider boundaries.

### D3: Use a daemon-owned MCP client module

- **Choice**: Add a focused MCP client/runtime module under `apps/daemon/src/mcp-client.ts` and keep Figma-specific orchestration in `apps/daemon/src/mcp.ts`.
- **Reason**: The project currently has no MCP client dependency; a small boundary keeps protocol lifecycle code separate from route/state code.
- **Alternatives considered**:
  - Keep Figma MCP as token-only smoke: rejected because the user's priority is making Figma MCP actually connect.
  - Use desktop-side MCP tools: rejected by project boundary; renderer must not manage MCP.

### D4: Make Figma MCP command/tool configuration explicit

- **Choice**: Read Figma MCP command, args, env, and optional read tool name from daemon config/env first; surface "not configured" if missing.
- **Reason**: Figma MCP server implementations vary. Tool discovery must be visible before assuming a tool name.
- **Alternatives considered**:
  - Hard-code one Figma MCP server command and tool name: rejected because it would be brittle across local setups.

### D5: Keep write smoke gated and conservative

- **Choice**: This change improves Figma MCP connection/read smoke; write smoke remains behind existing approval/change ID gates and may stay dry-run if no safe controlled write tool is configured.
- **Reason**: Connection reliability should land before expanding destructive Figma operations.
- **Alternatives considered**:
  - Add real Figma write tool calls now: rejected because writeback safety and approved change semantics deserve a dedicated follow-up.

## Risks / Trade-offs

- [Risk] MCP server command and tool names vary by installation. → Mitigation: make command/args/tool names configurable and expose discovered tools in `/mcp/servers`.
- [Risk] CLI smoke commands can hang or enter auth flows. → Mitigation: bounded timeouts, structured timeout diagnostics, and no renderer subprocesses.
- [Risk] Codex wrapper may exist while the real binary is missing. → Mitigation: detect spawn `ENOENT` from version probes and show reinstall guidance.
- [Risk] Adding MCP SDK dependency increases daemon surface area. → Mitigation: isolate it in `mcp-client.ts` and test with a fake stdio MCP server.
- [Trade-off] The first Figma MCP read smoke may require a configured tool name instead of guessing. → Accepted because explicit configuration is more reliable than hard-coded assumptions.

## Migration Plan

1. Add contracts for connection diagnostics and extend agent/MCP contract schemas in a backward-compatible way.
2. Add failing tests for CLI broken-wrapper detection and structured smoke payloads.
3. Implement CLI diagnostic classification in `packages/agent-adapters`.
4. Add a daemon MCP client wrapper and fake-MCP tests.
5. Wire Figma MCP config/status/tool discovery/read smoke in daemon routes.
6. Update desktop Agents/MCP panel to display diagnostics and expose a Figma read smoke action.
7. Update README and `docs/linear-openspec-map.md` with the new change and manual verification flow.

Rollback: since changes are additive and daemon-owned, rollback by reverting this change. Existing basic `/agents` and MCP toggle behavior remains structurally compatible.

## Open Questions

- Which exact Figma MCP server command should be the documented default for this user's machine?
- Which read tool should be preferred when multiple Figma MCP tools are discovered?
- Should Figma MCP config be persisted in `PlatformStore` in this change or remain env-driven until the first real user setup pass?
