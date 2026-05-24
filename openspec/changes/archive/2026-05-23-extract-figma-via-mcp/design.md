# Design · extract-figma-via-mcp

## Goal

Deliver a trustworthy Frame-only loop: the user selects one Figma Frame, Writer reviews the real text inside that Frame, and Writer changes only explicitly approved text nodes after the user chooses to apply them.

## User Flow

```text
Sources                         Review                              Figma
  |                               |                                  |
  | paste /design/...node-id=...  |                                  |
  |---- create frame session ---->|                                  |
  |                               |-- Run audit -------------------->|
  |                               |<-- real text nodes via MCP ------|
  |                               | show suggestions                  |
  |                               | approve/edit/reject               |
  |                               | Apply approved to Figma           |
  |                               |-- permission confirmation         |
  |                               |-- use_figma write -------------->|
  |                               |<-- per-node result ---------------|
  |                               | show applied/failed status        |
```

Approval and mutation are separate operations. No Figma content changes during extraction, audit, approval, or editing.

## Scope Contract

`FigmaReviewScope` for this slice is one selected Frame:

```ts
type FigmaFrameScope = {
  kind: "frame";
  fileKey: string;
  nodeId: string;
  frameName?: string;
};
```

`parseFigmaUrl()` accepts only `/design/<fileKey>/...?...node-id=<id>` and returns a frame scope. A design URL without `node-id`, or a `/make/`, `/board/`, or `/slides/` URL, returns an `unsupported_source` diagnostic at session intake.

## Data Model

A Figma session stores stable identity and extraction outcome:

```ts
type FigmaTextExtraction = {
  scope: FigmaFrameScope;
  nodes: FigmaTextNode[];
  warnings: ConnectionDiagnostic[];
  extractedAt: string;
};

type ReviewSession = {
  // existing properties
  figmaExtraction?: FigmaTextExtraction;
  designContext?: DesignContext;
  diagnostic?: ConnectionDiagnostic;
};

type ReviewQueue = {
  findings: UxCopyFinding[];
  rewrites: RewriteCandidate[];
  changes: ReviewChange[];
  diagnostic?: ConnectionDiagnostic;
};
```

Each `FigmaTextNode.id` is the original Figma text node ID. Each resulting `ReviewChange.sourceId` is that same ID, so writeback targets the exact originating node.

New diagnostic codes:

- `unsupported_source`
- `mcp_not_ready`
- `partial_read_failure`
- `write_conflict`
- `write_failed`

## Component Boundaries

### Contracts and Storage

- `packages/contracts` defines persisted extraction, queue result, diagnostics, and writeback result schemas.
- `packages/storage` stores those typed session fields unchanged.

### Review Core

`packages/review-core` remains daemon-agnostic:

```ts
interface FigmaMcpReader {
  status: "connected" | "disconnected" | "error";
  getMetadata(scope: FigmaFrameScope): Promise<McpCallToolResult>;
  getDesignContext(fileKey: string, nodeId: string): Promise<McpCallToolResult>;
}
```

It parses metadata hierarchy, extracts text from recorded design-context result shapes, and emits `FigmaTextExtraction` plus `DesignContext`. It does not manage OAuth, permissions, storage, or write operations.

### Daemon

- Normalizes the session scope at `/sessions/figma`.
- Adapts `state.mcp.figmaClient.callTool` to `FigmaMcpReader`.
- Runs extraction when a Figma audit starts, persists output, and passes real node content into `runStubAudit` until the analysis engine is replaced separately.
- Owns write permissions, eligible-change validation, MCP write invocation, status transitions, and audit log entries.

### Desktop

- Sources accepts and identifies a Frame link.
- Review surfaces read diagnostics and a connection recovery link.
- Queue supports current approve/edit/reject behavior.
- A separate `Apply approved to Figma` action submits eligible changes and displays per-node results.

## Extraction Algorithm

1. Require a connected MCP client or return `mcp_not_ready`.
2. Call `get_metadata({ fileKey, nodeId })` for the selected Frame.
3. Parse metadata XML and collect descendant TEXT references with hierarchy paths.
4. For each text reference, call `get_design_context({ fileKey, nodeId: textNodeId })`.
5. Parse the actual displayed characters from the recorded MCP content shape.
6. When one node cannot be read, omit it and add a `partial_read_failure` warning; do not fabricate text.
7. Persist extraction and context; audit uses `nodes.map(({ id, characters }) => ({ sourceId: id, text: characters }))`.

No caching is introduced: each audit intentionally reflects the currently selected Frame.

## Writeback Algorithm

`POST /figma/writeback` receives a `sessionId` and selected eligible `changeIds`.

1. Load the Figma session and require its normalized frame scope and completed extraction.
2. Resolve each requested change; accept only `approved` or `edited` status belonging to this session.
3. Require a confirmed `figma.write` permission request through the existing daemon gate.
4. Build one `use_figma` MCP invocation for the batch. Its JavaScript:
   - gets each originating node by `sourceId`;
   - requires a TEXT node;
   - checks `node.characters === change.before` before mutation;
   - loads required fonts;
   - assigns `node.characters = change.after`;
   - returns a structured per-node applied/failed result.
5. Transition successful changes to `applied`; failed/conflicted changes to `failed` with an accurate result message.
6. Persist results and audit log entries.

The equality check protects a designer's newer edits made after audit. A conflict fails only that item and can be re-audited before retry.

## Error Handling

| Situation | Result |
| --- | --- |
| Source is not a selected `/design/` Frame URL | Reject session intake with `unsupported_source` guidance |
| MCP disconnected during audit | Return/persist `mcp_not_ready`; produce no queue changes |
| Frame contains no readable text | Successful empty extraction; show "No text found in selected Frame" |
| One text read fails | Continue siblings and surface `partial_read_failure` |
| MCP disconnected before apply | Keep approvals; return failed diagnostic, no state falsely applied |
| Source text changed since audit | `write_conflict`; do not overwrite |
| One MCP node update fails | Mark that item failed; preserve successfully applied siblings |

## Testing Strategy

- Contracts/storage unit tests: persisted extraction, diagnostics, queue response, writeback results.
- Review-core unit tests with recorded MCP fixtures: Frame metadata parsing, real text extraction, no-stub failure behavior, partial reads.
- Daemon unit/integration tests: session normalization, real audit input, disconnected response, permission-gated `use_figma`, conflicts, partial write failure.
- Desktop tests: diagnostic display and explicit apply action behavior.
- Manual smoke: connected Frame extraction; approve without mutation; explicit apply; disconnected recovery; stale-text conflict.

## Security and Permissions

Reading Frame data uses only MCP read operations. Writeback runs only through daemon-owned `figma.write`, after explicit user apply and permission confirmation. Renderer code never owns an MCP client or writes to Figma directly.
