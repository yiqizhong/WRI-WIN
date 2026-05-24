# Implementation Plan · extract-figma-via-mcp

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace `extractFigmaTextNodes` and `captureDesignContext` stubs with real Figma MCP `get_metadata` + `get_design_context` calls so figma sessions read actual frame text and structure.

**Architecture:** review-core owns extraction, takes an injected `McpCaller`; daemon wires `state.mcp.figmaClient.callTool`. No new deps. Per-TEXT-node `get_design_context` calls with defensive XML parsing of metadata.

**Tech Stack:** TypeScript, existing `@modelcontextprotocol/sdk` daemon client, Vitest for tests.

---

## Execution order (Linear — issue numbers TBD)

| Order | Issue | OpenSpec tasks | Deliverable |
|-------|-------|----------------|-------------|
| 1 | WRI-TBD-a | 1.1–1.4 | Contracts + McpCaller interface in review-core |
| 2 | WRI-TBD-b | 2.1–2.5 | MCP-backed extract + design-context in review-core |
| 3 | WRI-TBD-c | 3.1–3.4 | Daemon wiring + diagnostic surface |
| 4 | WRI-TBD-d | 4.1–4.3 | Desktop diagnostic surface + README update |

## Issue 1 — Contracts and interface

1. Move `McpCallToolResult` type from `apps/daemon/src/mcp-client.ts` into `packages/contracts/src/mcp.ts`.
2. Add `McpCaller` interface in `packages/review-core/src/mcp-caller.ts` (depends on contract type).
3. Add `FigmaExtractionResult` discriminated union: `{ ok: true; extraction } | { ok: false; diagnostic }`.
4. Add `mcp_not_ready` to the connection diagnostic code enum if not already present.

## Issue 2 — review-core extraction

1. `packages/review-core/src/figma-extract-mcp.ts` — `extractFigmaTextNodesViaMcp(scope, mcpCaller)` per design.
2. Hand-rolled defensive XML parser for `get_metadata` response (recursive descent, ignore unknown).
3. `extractCharactersFromDesignContext` — regex on the code string with fallback.
4. `captureDesignContextViaMcp(scope, mcpCaller)` — reuse the metadata XML walk; no extra request.
5. Vitest with fake `McpCaller`: happy path, mcp_not_ready, per-node degradation, flow scope.

## Issue 3 — daemon wiring

1. `apps/daemon/src/review.ts` — `runAudit` for figma sessions calls `extractFigmaTextNodesViaMcp` with `state.mcp.figmaClient` adapted to `McpCaller`.
2. Adapter: thin object exposing `{ callTool, status }` derived from `state.mcp.figma.status`.
3. Persist real nodes + diagnostic onto the session via `state.store`.
4. Integration test in `apps/daemon/src/integration.test.ts`: fake MCP client returns canned responses; assert queue.

## Issue 4 — desktop + docs

1. Surface `mcp_not_ready` diagnostic on the Review screen with a "Connect Figma" button that routes to the Agents/MCP panel's existing flow.
2. No new screen — reuse the workflow message bar in `workspace-context.tsx`.
3. Update `README.md`: delete the "Full Figma extraction and writeback still use bootstrap paths" Known-limitations line; add a one-liner under Quick start about pasting a frame URL.

## Verification gates

After each issue:
- `npm run typecheck`
- `npm run test`
- Linear: mark issue Done + comment with commit SHA.

End of change:
- Manual: paste a real Figma frame URL into Sources, click Start, run audit, see real text from that frame.
- `openspec change validate extract-figma-via-mcp`.

## Worktree

Single worktree on `main` until Issue 3; if Issue 4 desktop change overlaps with concurrent UI work, spawn `extract-figma-via-mcp-ui` worktree.
