# figma-mcp-extraction Specification

## Purpose

Extract real Figma text and design hierarchy for review sessions via the Figma MCP server (`get_metadata`, `get_design_context`, and `use_figma` text reads), without synthetic stub copy.
## Requirements
### Requirement: Figma extraction reads real text nodes via MCP
The system SHALL extract Figma text nodes by calling the Figma MCP server's `get_metadata` and `get_design_context` tools for the user-provided scope, and MUST NOT return synthetic or hardcoded text nodes.

#### Scenario: Frame URL produces real text nodes
- **WHEN** a review session is created with a `figma` source whose scope is a frame, and the Figma MCP server is connected
- **THEN** running the audit returns text nodes whose `characters` field reflects the actual text content present in that frame, as reported by the MCP `get_design_context` tool

#### Scenario: Page URL produces real text nodes
- **WHEN** a review session is created with a `figma` source whose scope is a page, and the Figma MCP server is connected
- **THEN** running the audit returns text nodes for every TEXT layer descended from that page in the metadata XML returned by `get_metadata`

#### Scenario: Flow scope iterates frames
- **WHEN** a review session is created with a `figma` source whose scope is a flow with multiple node ids, and the Figma MCP server is connected
- **THEN** the extraction calls `get_metadata` for each node id in the flow and unions the resulting text nodes in flow order

### Requirement: Design context hierarchy is built from real MCP metadata
The system SHALL populate the design context hierarchy from the structure returned by `get_metadata`, capturing real node ids, names, types, and parent relationships.

#### Scenario: Hierarchy mirrors MCP metadata
- **WHEN** a figma session audit runs and the MCP server returns metadata
- **THEN** the resulting `DesignContext.hierarchy` contains one entry per non-trivial node in the metadata response, each with the id, name, and type reported by MCP, and parentId set from the metadata parent chain

### Requirement: MCP-not-ready state is surfaced as a structured diagnostic
The system SHALL surface a structured `mcp_not_ready` diagnostic when figma extraction is requested while the Figma MCP client is not connected, and MUST NOT fall back to synthetic text nodes.

#### Scenario: MCP disconnected at audit time
- **WHEN** the user runs the audit on a figma session while the Figma MCP server is disabled or disconnected
- **THEN** the audit response carries a `diagnostic` with code `mcp_not_ready`, severity `warning`, and a recovery action that points the user at the Connect Figma flow, and no text nodes are produced

### Requirement: Per-node MCP failures degrade gracefully
The system SHALL tolerate failures of individual `get_design_context` calls during parallel extraction so that one broken node does not abort or delay other nodes in the pool.

#### Scenario: One TEXT node fails design context fetch
- **WHEN** extraction encounters a non-ok response from `get_design_context` for a single TEXT node during parallel reads
- **THEN** that node is represented by a fallback node (name-derived characters), a warning is logged, and all other nodes complete normally

#### Scenario: Slow node does not block others
- **WHEN** one text node takes significantly longer to read than others in the pool
- **THEN** the other nodes complete and their results are available while the slow node is still in flight; the pool never exceeds the configured concurrency limit

### Requirement: Figma Make files are reported as unsupported
The system SHALL detect Figma URLs whose path includes `/make/` and surface an unsupported-source diagnostic instead of attempting `get_metadata`.

#### Scenario: User pastes a Figma Make URL
- **WHEN** a review session is created from a URL containing `/make/`
- **THEN** the audit returns a diagnostic with severity `warning` and a message stating that Figma Make files are not supported for extraction, with no MCP calls made

### Requirement: List frames on a Figma page
The system SHALL expose `POST /figma/list-page-frames` that, given a Figma page URL, returns UI `FRAME` nodes (including inside `SECTION` containers) with bounding boxes and auto-detected flow direction (`horizontal`, `vertical`, or `grid`). `SECTION` and non-frame types are excluded.

#### Scenario: MCP not ready for list-page-frames
- **WHEN** the endpoint is called while Figma MCP is disconnected
- **THEN** the response carries `mcp_not_ready` with recovery pointing to Connect Figma

### Requirement: Capture frame screenshots at audit completion
When an audit completes, the system SHALL capture per-frame screenshots via MCP `get_screenshot`, persist PNGs under the session screenshots directory, and record `frameScreenshots` on the session. Per-frame failure is non-fatal.

#### Scenario: Workflow audit captures ordered screenshots
- **WHEN** a flow-scoped audit completes
- **THEN** `frameScreenshots` contains one entry per frame in flow order

### Requirement: Extraction node count SHALL be capped at a configurable maximum
The system SHALL cap the total number of text-node references read during extraction at `MAX_EXTRACTION_NODES` (default 500, overridable via `WRITER_FIGMA_MAX_NODES`). The cap MUST apply to the combined total of directly scanned nodes and instance-scan nodes. When the frame contains more nodes than the cap, the system MUST record a non-fatal diagnostic and proceed with the capped set.

#### Scenario: Frame with more than 500 text nodes
- **WHEN** extraction collects more than 500 text-node references (including from instance scan)
- **THEN** exactly 500 nodes are read, a diagnostic "Analyzed the first 500 of N text nodes" is recorded, and extraction completes successfully

#### Scenario: Frame with fewer nodes than cap
- **WHEN** extraction collects 300 text-node references
- **THEN** all 300 nodes are read and no truncation diagnostic is recorded

### Requirement: Extraction SHALL support an optional progress callback
The system SHALL accept an optional `onProgress: (p: { completed: number; total: number }) => void` parameter on `extractFigmaTextNodesViaMcp`. When provided, the callback MUST be invoked once per completed node read, with `completed` monotonically increasing from 1 to `total`.

#### Scenario: Progress fires per completed node
- **WHEN** extraction reads N capped nodes and an `onProgress` callback is provided
- **THEN** the callback is invoked exactly N times with `completed` values 1 through N and `total` equal to N

#### Scenario: No callback — extraction still completes
- **WHEN** no `onProgress` callback is provided
- **THEN** extraction completes normally with no error

### Requirement: Daemon SHALL surface live Figma extraction progress to the UI
The system SHALL wire the extractor's `onProgress` callback to write `progressMessage: "Reading text from Figma… <completed> / <total>"` to the guideline generation session, throttled to at most once per second.

#### Scenario: Progress message updates during extraction
- **WHEN** the daemon runs guideline generation and the extractor fires `onProgress`
- **THEN** the session's `progressMessage` is updated to reflect the current completed/total count, visible to the UI via the existing polling mechanism

