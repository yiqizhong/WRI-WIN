## ADDED Requirements

### Requirement: Figma Frame sessions persist extraction identity and diagnostics
The system SHALL persist real extracted text nodes, design context, and relevant diagnostics on the review session so review and writeback refer to the same originating Figma nodes.

#### Scenario: Audit persists real text nodes
- **WHEN** an audit succeeds on a connected selected Frame session
- **THEN** the persisted session includes each extracted text node id, path, original characters, style hints, visibility, and real design context

#### Scenario: Failed extraction persists no stub text
- **WHEN** Frame extraction cannot run because MCP is not connected
- **THEN** the session records the diagnostic and contains no synthetic text nodes or derived review changes

### Requirement: Writeback history reflects actual mutations
The system SHALL persist accurate per-node writeback results and audit log records for an apply operation.

#### Scenario: Mixed apply result survives reload
- **WHEN** applying approved Frame changes succeeds for one text node and fails for another
- **THEN** persisted review changes and audit entries show one applied result and one failed result after application restart
