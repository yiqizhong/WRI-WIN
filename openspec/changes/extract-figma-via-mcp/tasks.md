# Tasks · extract-figma-via-mcp

Maps to Linear epic **WRI-TBD** (parent) and child issues TBD.

## 1. Contracts + McpCaller interface

- [ ] 1.1 Promote `McpCallToolResult` from `apps/daemon/src/mcp-client.ts` to `packages/contracts/src/mcp.ts`
- [ ] 1.2 Add `McpCaller` interface and `FigmaExtractionResult` union in `packages/review-core/src/mcp-caller.ts`
- [ ] 1.3 Extend `ConnectionDiagnostic` code enum with `mcp_not_ready` (if not already present)
- [ ] 1.4 Update daemon imports to consume the moved type; `npm run typecheck`

## 2. review-core MCP extraction

- [ ] 2.1 Add `packages/review-core/src/figma-extract-mcp.ts` with `extractFigmaTextNodesViaMcp(scope, mcpCaller)`
- [ ] 2.2 Hand-rolled defensive XML walker for `get_metadata` responses (recursive descent, capture TEXT nodes + ancestor path)
- [ ] 2.3 `extractCharactersFromDesignContext(code)` regex with name-fallback
- [ ] 2.4 Add `captureDesignContextViaMcp(scope, mcpCaller, metadataXml)` reusing the metadata walk (no extra request)
- [ ] 2.5 Vitest fixtures: happy path (frame), happy path (flow), mcp_not_ready, per-node degradation, malformed XML tolerated

## 3. Daemon wiring

- [ ] 3.1 Adapter in `apps/daemon/src/review.ts` exposing `state.mcp.figmaClient` as `McpCaller` (`{ callTool, status }`)
- [ ] 3.2 `runAudit` for figma sessions calls `extractFigmaTextNodesViaMcp` + `captureDesignContextViaMcp`; persist real nodes/context onto session
- [ ] 3.3 On failure write structured diagnostic onto the session and surface in the queue response
- [ ] 3.4 Integration test in `apps/daemon/src/integration.test.ts`: inject fake MCP client → `/sessions` + `/review/audit/run` → assert real characters in queue
- [ ] 3.5 In-memory per-session cache (60s) keyed on `${fileKey}:${nodeId}` to avoid duplicate fetches on rapid re-audit

## 4. Desktop + docs

- [ ] 4.1 Show `mcp_not_ready` diagnostic on the Review screen with a "Connect Figma" action routing to the existing Agents/MCP panel flow
- [ ] 4.2 Remove the "Full Figma extraction and writeback still use bootstrap paths" line from `README.md` Known limitations
- [ ] 4.3 Add a short Quick-start note about pasting a frame URL and what to expect

## 5. Cleanup

- [ ] 5.1 Delete `packages/review-core/src/figma-extract.ts` (stub) and `packages/review-core/src/design-context.ts` (stub) once nothing imports them
- [ ] 5.2 Update `packages/review-core/src/index.ts` exports
- [ ] 5.3 Update `docs/linear-openspec-map.md` with this change's mapping

## Verification

- `npm run typecheck && npm run test`
- `openspec change validate extract-figma-via-mcp`
- Manual: open desktop → Sources → paste a real Figma frame URL → Connect → Start session → Run audit → Review screen shows the actual text from that frame, not the stub "Continue" / "Review your UX copy before publishing." strings
- Manual: disconnect Figma MCP → run audit → see `mcp_not_ready` diagnostic + Connect button, no stub fallback
