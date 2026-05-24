# Design · extract-figma-via-mcp

## Goal

When a user pastes a Figma Page or Frame URL into the Sources screen and starts a review session, the daemon SHALL call the Figma MCP server to read real text nodes and design context — never stub data.

## Architecture

### Layering

```
desktop (UI)
   │
   │  POST /sessions  /  POST /review/audit/run
   ▼
apps/daemon (review.ts)
   │
   │  buildFigmaExtractor(mcpClient)
   ▼
packages/review-core (figma-extract-mcp.ts)
   │
   │  McpCaller interface
   ▼
apps/daemon (state.mcp.figmaClient.callTool)
   │
   ▼
Figma MCP server (remote https://mcp.figma.com/mcp)
```

Review-core stays daemon-agnostic; daemon injects an `McpCaller`.

### McpCaller interface (new, in review-core)

```ts
export interface McpCaller {
  callTool(name: string, args: Record<string, unknown>): Promise<McpCallToolResult>;
  status: "connected" | "disconnected" | "error";
}
```

`McpCallToolResult` shape already exists in `apps/daemon/src/mcp-client.ts` — promote the type to `packages/contracts` so review-core can import it without depending on daemon.

### Extraction algorithm

```
extractFigmaTextNodesViaMcp(scope, mcpCaller):

  if mcpCaller.status !== "connected":
    return { ok: false, diagnostic: { code: "mcp_not_ready", ... } }

  metadata = await mcpCaller.callTool("get_metadata", {
    fileKey: scope.fileKey,
    nodeId: scope.kind === "frame" ? scope.nodeId
          : scope.kind === "page"  ? scope.pageId
          : scope.kind === "flow"  ? scope.nodeIds[0]
          : undefined  // file → list pages
  })

  if !metadata.ok:
    return { ok: false, diagnostic: metadata.diagnostic }

  textNodeRefs = parseTextNodesFromMetadataXml(metadata.result)
  // for flow: union across all nodeIds

  nodes: FigmaTextNode[] = []
  for ref in textNodeRefs:
    ctx = await mcpCaller.callTool("get_design_context", {
      fileKey: scope.fileKey,
      nodeId: ref.id
    })
    if ctx.ok:
      nodes.push({
        id: ref.id,
        name: ref.name,
        path: ref.path,           // built from metadata parent chain
        characters: extractCharactersFromCode(ctx.result),
        styleHints: extractStyleHints(ctx.result),
        visible: ref.visible
      })

  return { ok: true, extraction: { scope, nodes, extractedAt: now() } }
```

**parseTextNodesFromMetadataXml**: walk the returned XML, collect every element with `type="TEXT"`, capture `id`, `name`, `visible`, and ancestor name chain for `path`. Use a streaming/recursive-descent parser; XML structure is documented in MCP server's response (small, well-formed).

**extractCharactersFromCode**: `get_design_context` returns a code string (React-ish JSX/HTML). For a TEXT node target, the response includes the rendered text — extract via simple regex on the code string (`>([^<]+)</`). If that fails, fall back to the screenshot-less `metadata.result` name. Robustness > cleverness — wrap in try/catch and degrade gracefully per node, never per whole extraction.

### Design context

`captureDesignContextViaMcp(scope, mcpCaller, metadataXml)`: build `DesignContext.hierarchy` from the same `metadata` XML walk (id, name, type, parentId). No extra MCP calls; reuse the response from the extraction call.

### Daemon wiring

`apps/daemon/src/review.ts`:

- `extractFigmaNodes(input)` becomes `async` and takes the daemon state (or just the mcpClient).
- `createFigmaSession(input)` does NOT call MCP yet — only persists the parsed scope. MCP calls happen on `runAudit` so that session creation stays fast and offline-tolerant.
- `runAudit(sessionId)` for figma sessions:
  - if `state.mcp.figmaClient` is null → write `mcp_not_ready` diagnostic onto the session, return ok=false with the diagnostic.
  - else → call `extractFigmaTextNodesViaMcp` + `captureDesignContextViaMcp`, persist real nodes + context, return the queue as today.

### Caching

Per-session in-memory cache: don't re-fetch metadata if the same audit is re-run within 60s. Avoids hammering MCP on user refresh. Cache key = `${fileKey}:${nodeId}`.

## Tech stack

- Existing `@modelcontextprotocol/sdk` client in daemon (already in `apps/daemon/src/mcp-client.ts`).
- No new deps. XML parsing: tiny hand-rolled recursive parser (MCP XML is small and well-formed); avoid pulling in a full XML lib.

## Risks

- **Per-TEXT `get_design_context` is N requests.** For frames with 50+ text nodes this is 50+ HTTP round trips. Mitigation: batch by parent component when `get_design_context` returns text for multiple descendants in one call (it does for component instances). Profile in integration test; if >10s for a typical frame, add a cap (e.g., first 100 text nodes, paginate the rest).
- **XML schema drift.** MCP XML shape is not contractual. Mitigation: defensive parsing — never throw on unknown elements, log and skip.
- **OAuth token expiry mid-audit.** Existing client handles 401 → refresh; verify by killing the cached token and re-running.
- **Make files.** Out of scope; daemon SHALL detect `/make/` URLs in `parseFigmaUrl` (already does?) and surface a clear "not supported" diagnostic instead of attempting `get_metadata`.

## Test strategy

- Unit (review-core): fake `McpCaller` returning canned `get_metadata` XML + `get_design_context` payloads → assert `FigmaTextNode[]` shape.
- Unit: `mcp_not_ready` diagnostic when `mcpCaller.status !== "connected"`.
- Unit: degradation per node — one failing `get_design_context` doesn't fail the whole extraction.
- Integration (daemon): inject a fake MCP client into `DaemonState.mcp`, POST `/sessions` + `/review/audit/run`, assert queue contains real characters.
- Smoke (manual, optional): real MCP, real Figma frame, real characters.
