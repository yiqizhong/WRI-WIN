## ADDED Requirements

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
The system SHALL tolerate failures of individual `get_design_context` calls during extraction so that one broken node does not abort the whole extraction.

#### Scenario: One TEXT node fails design context fetch
- **WHEN** extraction encounters a non-ok response from `get_design_context` for a single TEXT node
- **THEN** that node is omitted from the extraction with a logged warning, and remaining text nodes are still returned to the caller

### Requirement: Figma Make files are reported as unsupported
The system SHALL detect Figma URLs whose path includes `/make/` and surface an unsupported-source diagnostic instead of attempting `get_metadata`.

#### Scenario: User pastes a Figma Make URL
- **WHEN** a review session is created from a URL containing `/make/`
- **THEN** the audit returns a diagnostic with severity `warning` and a message stating that Figma Make files are not supported for extraction, with no MCP calls made
