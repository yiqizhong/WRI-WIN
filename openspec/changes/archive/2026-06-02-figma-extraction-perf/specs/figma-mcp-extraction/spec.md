## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Per-node MCP failures degrade gracefully
The system SHALL tolerate failures of individual `get_design_context` calls during parallel extraction so that one broken node does not abort or delay other nodes in the pool.

#### Scenario: One TEXT node fails design context fetch
- **WHEN** extraction encounters a non-ok response from `get_design_context` for a single TEXT node during parallel reads
- **THEN** that node is represented by a fallback node (name-derived characters), a warning is logged, and all other nodes complete normally

#### Scenario: Slow node does not block others
- **WHEN** one text node takes significantly longer to read than others in the pool
- **THEN** the other nodes complete and their results are available while the slow node is still in flight; the pool never exceeds the configured concurrency limit
