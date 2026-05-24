## Why

The Sources screen accepts Figma Page and Frame links, but the review pipeline still returns hardcoded stub text ("Primary CTA: Continue", "Subtitle: Review your UX copy before publishing.") regardless of what the link points to. The Figma MCP server is genuinely connected — `whoami` and 18 tools are discovered — yet none of those tools are called from the extraction path. The previous change (`harden-local-cli-figma-mcp-connections`) explicitly deferred this: "Figma MCP is a critical integration and must prove real connectivity before deeper Figma extraction and writeback work depends on it." That proof has landed; the dependent work has not. Without real extraction the Figma intake form is decorative, and downstream audit/rewrite work has nothing real to operate on.

## What Changes

**Figma text extraction**
- From: `extractFigmaTextNodes` returns hardcoded stub nodes derived only from scope kind.
- To: extraction calls Figma MCP `get_metadata` to discover real TEXT nodes under the scoped fileKey/nodeId, then `get_design_context` to read real `characters` and style hints.
- Reason: the app must actually read the user's Figma frame, not invent text.
- Impact: non-breaking on `FigmaTextNode` contract; behavior of `/sessions` and `/review/audit/run` changes for `sourceType: "figma"` sessions when MCP is connected.

**Design context capture**
- From: `captureDesignContext` synthesizes a fake hierarchy from scope kind.
- To: hierarchy is built from the real MCP `get_metadata` XML response (node id, name, type, parentId).
- Reason: downstream rewrite prompts need real structural context.
- Impact: additive — same `DesignContext` shape, populated with real data.

**MCP-not-ready behavior**
- From: extraction silently succeeds with stub data when MCP is disconnected.
- To: extraction returns a structured `mcp_not_ready` diagnostic instead of fake data; desktop surfaces it with a recovery action ("Connect Figma").
- Reason: silent stubbing trained users to think the integration worked. Better to fail loud and actionable.
- Impact: `/review/audit/run` may return a non-ok result when MCP is not connected for figma sessions.

## Capabilities

### New Capabilities

- `figma-mcp-extraction` — real Figma text node and design context extraction via MCP `get_metadata` + `get_design_context`, scoped to file/page/frame/flow links.

### Modified Capabilities

- `tool-mcp-runtime` — Figma MCP client exposes a typed caller usable by the review pipeline, not only by smoke endpoints.
- `review-session-storage` — figma sessions persist real extracted text nodes and design context produced from MCP responses.

## Impact

- `packages/review-core` — replace `figma-extract.ts` and `design-context.ts` stubs with MCP-backed implementations; inject an `McpCaller` interface so the package stays daemon-agnostic and testable.
- `packages/contracts` — minor: add `mcp_not_ready` to the figma extraction diagnostic enum if not already covered by `ConnectionDiagnostic`.
- `apps/daemon` — wire `state.mcp.figmaClient` into `createFigmaSession` / `runAudit` extraction paths; surface MCP errors as structured diagnostics on the session.
- `apps/desktop` — surface `mcp_not_ready` diagnostic on the Sources / Review screens with a "Connect Figma" action (the action already exists, just route to it from the new error path).
- `README.md` — remove the "Full Figma extraction and writeback still use bootstrap paths" line from Known limitations.
- `docs/linear-openspec-map.md` — add mapping entry once Linear issue is created.

## Non-Goals (this change)

- Exposing all 18 Figma MCP tools to the desktop UI — that is a separate change (`expose-figma-mcp-tools`, to be opened next).
- Writeback (`use_figma`, `upload_assets`, `create_new_file`, etc.) — gated by permissions and out of scope for read-only extraction.
- Screenshot embedding in the review queue UI — `get_screenshot` may be called for design context, but rendering screenshots in desktop is deferred.
- Streaming extraction progress to the UI — single request/response is fine for v1.
- Handling `figma.com/make/` URLs — Make files are not supported by `get_metadata` per the MCP tool description.
