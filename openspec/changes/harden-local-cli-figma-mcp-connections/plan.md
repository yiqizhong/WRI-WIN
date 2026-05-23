# Harden Local CLI and Figma MCP Connections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Writer's local CLI LLM providers and Figma MCP integration diagnosable, testable, and usable from the desktop app.

**Architecture:** Add shared connection diagnostics in `@writer/contracts`, classify CLI failures inside `packages/agent-adapters`, and keep all MCP lifecycle/process work in the daemon. The desktop remains a status/control surface only.

**Tech Stack:** TypeScript ESM, Zod, Vitest, Node child_process, React 19, Electron 39, `@modelcontextprotocol/sdk`.

---

## File Structure

- `packages/contracts/src/connection-diagnostic.ts`: shared diagnostic code/severity/schema.
- `packages/contracts/src/agent.ts`: add optional `diagnostic` to adapters and define structured smoke result if needed.
- `packages/contracts/src/mcp-server.ts`: add optional diagnostics, tool metadata, and smoke result schema.
- `packages/agent-adapters/src/cli-runner.ts`: preserve spawn error details and classify command execution failures.
- `packages/agent-adapters/src/create-cli-adapter.ts`: convert detect/smoke failures into diagnostics.
- `apps/daemon/src/mcp-client.ts`: small daemon-only MCP stdio client wrapper.
- `apps/daemon/src/mcp.ts`: Figma MCP config, lifecycle, tool discovery, and read smoke orchestration.
- `apps/daemon/src/routes/platform.ts`: route structured MCP read smoke responses.
- `apps/desktop/src/agents-panel.tsx`: render provider/MCP diagnostics and Figma read smoke control.
- `apps/desktop/src/daemon-client.ts`: parse MCP smoke response.
- `README.md`: setup and manual verification docs.
- `docs/linear-openspec-map.md`: new issue mapping.

## Task 1: Shared connection diagnostics

- [ ] **Step 1:** Write failing contract tests in `packages/contracts/src/connection-diagnostic.test.ts`.
  - Cover parsing `broken_executable`, `needs_auth`, `timeout`, `not_configured`, `tool_not_found`, and redacted details.
  - Run: `npm --workspace @writer/contracts run test -- connection-diagnostic.test.ts`
  - Expected: fail because the schema file does not exist.

- [ ] **Step 2:** Add `packages/contracts/src/connection-diagnostic.ts`.
  - Export `connectionDiagnosticCodeSchema`, `connectionDiagnosticSeveritySchema`, `connectionDiagnosticSchema`, and `parseConnectionDiagnostic`.
  - Diagnostic shape: `{ code, severity, message, recoveryAction?, command?, exitCode?, stdoutSnippet?, stderrSnippet?, metadata? }`.
  - Redaction rule: contracts allow snippets, but implementation must never include secret env values.

- [ ] **Step 3:** Extend `packages/contracts/src/agent.ts`.
  - Add optional `diagnostic` to `agentAdapterSchema`.
  - Add `agentSmokeResultSchema` with `{ ok, adapterId, adapter?, diagnostic?, output?, message? }`.
  - Export types from `packages/contracts/src/index.ts`.

- [ ] **Step 4:** Extend `packages/contracts/src/mcp-server.ts`.
  - Add `tools?: { name: string; description?: string }[]`.
  - Add `diagnostic?: ConnectionDiagnostic`.
  - Add `mcpSmokeResultSchema` for read smoke responses.

- [ ] **Step 5:** Run green checks.
  - Run: `npm --workspace @writer/contracts run test`
  - Run: `npm --workspace @writer/contracts run typecheck`

## Task 2: Local CLI LLM diagnostics

- [ ] **Step 1:** Write failing tests in `packages/agent-adapters/src/create-cli-adapter.test.ts`.
  - Add a fake command that exits non-zero with an `ENOENT` vendor-binary stack.
  - Assert detect returns `available: false`, `diagnostic.code === "broken_executable"`, and recovery guidance mentions reinstall/repair.
  - Add smoke timeout/non-zero tests if not already covered.

- [ ] **Step 2:** Run red test.
  - Run: `npm --workspace @writer/agent-adapters run test -- create-cli-adapter.test.ts`
  - Expected: fail because diagnostics are not implemented.

- [ ] **Step 3:** Update `packages/agent-adapters/src/cli-runner.ts`.
  - Preserve `errorCode?: string` and `spawnError?: string` on `CliRunResult`.
  - Ensure child `error` events produce snippets without throwing outside the result object.

- [ ] **Step 4:** Update `packages/agent-adapters/src/create-cli-adapter.ts`.
  - Add helpers `diagnosticFromProbeResult`, `diagnosticFromSmokeResult`, and `isBrokenExecutableFailure`.
  - Classify command missing, broken executable, timeout, needs auth, non-zero exit, and ready.
  - Attach diagnostics to detection results and smoke responses.

- [ ] **Step 5:** Update daemon smoke typing in `apps/daemon/src/agents.ts`.
  - Return structured `diagnostic` from `smokeAgentAdapter`.
  - Preserve existing `ok`, `adapterId`, `output`, and `message` fields for compatibility.

- [ ] **Step 6:** Run green checks.
  - Run: `npm --workspace @writer/agent-adapters run test`
  - Run: `npm --workspace @writer/daemon run test -- agents.test.ts`
  - Run: `npm run typecheck`

## Task 3: Figma MCP client runtime

- [ ] **Step 1:** Add failing daemon tests.
  - Create `apps/daemon/src/mcp-client.test.ts` with a fake MCP stdio server fixture or injected transport.
  - Assert connect initializes, lists tools, calls a read tool, and classifies not-configured/tool-not-found failures.
  - Run: `npm --workspace @writer/daemon run test -- mcp-client.test.ts`
  - Expected: fail because `mcp-client.ts` does not exist.

- [ ] **Step 2:** Add daemon dependency.
  - Run: `npm install --workspace @writer/daemon @modelcontextprotocol/sdk`
  - Verify `apps/daemon/package.json` and `package-lock.json` update only as needed.

- [ ] **Step 3:** Implement `apps/daemon/src/mcp-client.ts`.
  - Export `McpClientConfig`, `McpToolSummary`, `McpCallResult`, and `createMcpClient`.
  - Use stdio transport from the MCP SDK.
  - Provide `connect`, `listTools`, `callTool`, and `close` methods.
  - Return structured diagnostics instead of throwing for expected connection failures.

- [ ] **Step 4:** Update `apps/daemon/src/mcp.ts`.
  - Add `getFigmaMcpConfigFromEnv()`.
  - Support env vars: `WRITER_FIGMA_MCP_COMMAND`, `WRITER_FIGMA_MCP_ARGS`, `WRITER_FIGMA_MCP_READ_TOOL`, `FIGMA_ACCESS_TOKEN`.
  - On enable, connect and list tools; on disable, close client and mark disconnected.
  - Store discovered tools and diagnostics in `state.mcp.figma`.

- [ ] **Step 5:** Implement Figma read smoke.
  - If not configured, return `ok: false` with `not_configured`.
  - If connected but no read tool is configured/discovered, return `tool_not_found` with discovered names.
  - If a tool can be called, return `ok: true`, `toolName`, and bounded metadata.

- [ ] **Step 6:** Run green checks.
  - Run: `npm --workspace @writer/daemon run test -- mcp-client.test.ts mcp.smoke.test.ts`
  - Run: `npm --workspace @writer/daemon run typecheck`

## Task 4: Desktop connection UX

- [ ] **Step 1:** Write failing UI/helper tests.
  - Prefer a pure helper test in `apps/desktop/src/agent-test-status.test.ts` or a small component test using existing Vitest setup.
  - Assert diagnostic code, message, recovery action, and tool names become displayable strings.

- [ ] **Step 2:** Extend `apps/desktop/src/daemon-client.ts`.
  - Parse `mcpSmokeResultSchema`.
  - Add `smokeFigmaRead()`.

- [ ] **Step 3:** Update `apps/desktop/src/agents-panel.tsx`.
  - Render adapter diagnostic details below each provider.
  - Render Figma MCP status, diagnostic, and discovered tool names.
  - Add "Test Figma read" button that calls the daemon and shows result in the existing status banner pattern.

- [ ] **Step 4:** Update `apps/desktop/src/styles.css`.
  - Add compact styles for diagnostic blocks and tool chips.
  - Keep panel density consistent with the existing settings UI.

- [ ] **Step 5:** Run green checks.
  - Run: `npm --workspace @writer/desktop run test`
  - Run: `npm --workspace @writer/desktop run typecheck`

## Task 5: Linear, docs, and verification

- [ ] **Step 1:** Create or map Linear issues.
  - Create one epic/parent for connection hardening if none exists.
  - Create child issues for contracts/CLI, Figma MCP, desktop UX, and verification.
  - Update `docs/linear-openspec-map.md`.

- [ ] **Step 2:** Update `README.md`.
  - Add CLI diagnostic meanings and recovery examples.
  - Add Figma MCP env config and read smoke examples.
  - Keep BYOK/direct API out of the instructions.

- [ ] **Step 3:** Create `openspec/changes/harden-local-cli-figma-mcp-connections/verify.md`.
  - Record automated commands.
  - Record local CLI probe status for Claude, Cursor, Devin, and Codex broken-wrapper state.
  - Record Figma MCP manual status depending on available command/token config.

- [ ] **Step 4:** Run full verification.
  - Run: `npm run typecheck`
  - Run: `npm run test`
  - Run: `openspec validate harden-local-cli-figma-mcp-connections --type change --strict`

## Plan Self-Review

- Spec coverage: tasks cover connection diagnostics, local CLI provider diagnostics, agent adapter metadata, Figma MCP client lifecycle/read smoke, desktop display, docs, and verification.
- Placeholder scan: no TBD/TODO placeholders remain in implementation steps.
- Type consistency: diagnostic field names align across contracts, adapters, daemon, and desktop.
