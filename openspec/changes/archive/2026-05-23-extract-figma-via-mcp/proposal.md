## Why

Writer currently accepts a Figma link but does not perform the product workflow it promises. It returns hardcoded placeholder copy during extraction, then records a dry-run writeback as though changes were applied. For a user reviewing one selected Frame, both behaviors break trust: the app is neither reviewing their design nor updating it after approval.

The Figma MCP connection, approval state machine, and write permission gate already exist. This change connects them into the first complete Figma workflow: real Frame text in, explicit approved text out.

## What Changes

**Selected Frame intake**
- Accept a Figma `/design/` Frame link only when it contains a concrete `node-id`.
- Reject unsupported or overly broad sources instead of silently treating them as a valid extraction scope.

**Real text extraction and analysis input**
- Call Figma MCP read tools to discover the selected Frame's text nodes and read their actual characters.
- Persist original text node IDs and content on the session.
- Feed real extracted text into the existing audit/rewrite queue, eliminating Figma stub input paths.

**Human-gated real writeback**
- Keep approval/editing separate from mutation.
- Add an explicit `Apply approved to Figma` action for eligible `approved` and `edited` changes.
- Replace dry-run writeback with a permission-gated `use_figma` MCP mutation against original text node IDs.
- Prevent stale overwrite when the current Figma text differs from the originally reviewed text.

**Diagnostics and auditability**
- Surface unsupported source, MCP-not-ready, partial read failure, write conflict, and write failure states.
- Persist and display writeback results and audit-log records accurately.

## Capabilities

### New Capabilities

- `figma-mcp-extraction` - real text extraction from one selected Figma Frame through MCP.
- `figma-mcp-writeback` - explicit, approved, permission-gated mutation of originating Figma text nodes through MCP.

### Modified Capabilities

- `review-session-storage` - persist Frame extraction, diagnostics, and accurate writeback result state.
- `tool-mcp-runtime` - expose typed read/write MCP invocation to the review pipeline while retaining daemon authority.

## Impact

- `packages/contracts` - typed extraction/audit/writeback results, new diagnostics, persisted session fields.
- `packages/review-core` - Frame URL constraints and MCP-backed extraction/context behavior.
- `packages/storage` - persisted session extraction and diagnostic data.
- `apps/daemon` - MCP adapters, audit input replacement, permission-gated real writeback, integration tests.
- `apps/desktop` - Frame-only intake feedback, extraction diagnostics, and explicit apply UI.
- `README.md` and `docs/linear-openspec-map.md` - product behavior and Linear mapping updates.

## Linear Tracking

- Parent: `WRI-98` - Figma frame review and approved writeback via MCP
- `WRI-99` - Define Frame extraction and persisted review contracts
- `WRI-100` - Extract real Frame text and feed it into review audit
- `WRI-101` - Apply approved Frame copy back to Figma through MCP
- `WRI-102` - Expose Frame apply workflow and validate end to end

## Non-Goals

- File-wide, page-wide, or multi-frame flow extraction.
- Figma Make, FigJam, or Slides support.
- Figma comment/annotation writeback.
- Rendering screenshots or exposing all discovered MCP tools in desktop.
- Streaming extraction progress or introducing an extraction cache.
