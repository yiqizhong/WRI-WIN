<!-- Linear mapping to be added in docs/linear-openspec-map.md after issues are created. -->

## 1. Shared connection diagnostics

- [x] 1.1 Add `connection-diagnostics` contract schemas and tests in `packages/contracts`
- [x] 1.2 Extend agent adapter and MCP server contracts with optional diagnostic/tool metadata
- [x] 1.3 Update daemon/desktop call sites to compile against the extended contracts

## 2. Local CLI LLM provider hardening

- [x] 2.1 Add CLI runner tests for spawn `ENOENT`, timeout, and non-zero diagnostic classification
- [x] 2.2 Implement structured diagnostics in `packages/agent-adapters`
- [x] 2.3 Return structured diagnostics from `/agents/detect` and `/agents/smoke`
- [x] 2.4 Add a Codex broken-wrapper regression test using the observed vendor `ENOENT` failure shape

## 3. Figma MCP client runtime

- [x] 3.1 Add daemon MCP client tests using a fake stdio MCP server
- [x] 3.2 Add `@modelcontextprotocol/sdk` to the daemon workspace and implement a small MCP client wrapper
- [x] 3.3 Add Figma MCP config loading for command, args, env, and read tool preference
- [x] 3.4 Wire Figma MCP enable/disable, initialize, tool discovery, and diagnostics into `/mcp/servers`
- [x] 3.5 Implement Figma read smoke through MCP with clear `not_configured`, `tool_not_found`, auth, startup, timeout, and success results
- [x] 3.6 Add remote HTTP MCP URL config for Figma's recommended remote server path

## 4. Desktop connection UX

- [x] 4.1 Render CLI diagnostic severity, code, message, and recovery action in the Agents panel
- [x] 4.2 Render Figma MCP status, discovered tools, diagnostics, and read smoke action
- [x] 4.3 Add desktop tests for diagnostic rendering helpers or components

## 5. Documentation, Linear, and verification

- [x] 5.1 Create Linear issues for the change and add OpenSpec ↔ Linear mapping
- [x] 5.2 Update README with CLI diagnostics and Figma MCP configuration/smoke instructions
- [x] 5.3 Run `npm run typecheck`, `npm run test`, and `openspec validate harden-local-cli-figma-mcp-connections --type change --strict`
- [x] 5.4 Capture manual verification notes for installed CLIs and Figma MCP config in `verify.md`
- [x] 5.5 Capture official remote Figma MCP setup notes and local client status
