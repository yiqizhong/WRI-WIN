## ADDED Requirements

### Requirement: Figma sessions persist real extracted text nodes
The system SHALL persist the `FigmaTextNode[]` produced by MCP-backed extraction on the review session record so that the review queue and exports reflect the actual frame content, and MUST NOT persist synthetic stub text nodes for figma sessions.

#### Scenario: Audit persists real text nodes
- **WHEN** an audit runs successfully on a figma session against a connected Figma MCP server
- **THEN** the persisted session includes the `FigmaTextNode[]` returned by the extraction, including each node's id, name, path, characters, styleHints, and visibility

#### Scenario: MCP-not-ready leaves session text nodes empty
- **WHEN** an audit runs on a figma session while the Figma MCP server is disconnected
- **THEN** the persisted session records the `mcp_not_ready` diagnostic and contains no text nodes, instead of recording stub nodes
