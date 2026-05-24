## ADDED Requirements

### Requirement: Figma extraction reads real text in a selected Frame
The system SHALL accept a Figma design Frame URL with a concrete node id, extract descendant text through Figma MCP, and MUST NOT return synthetic or hardcoded text nodes.

#### Scenario: Frame URL produces real text nodes
- **WHEN** a review session is created from a `/design/` URL with a selected Frame node id and the Figma MCP server is connected
- **THEN** running the audit returns text nodes whose `characters` reflect text in that Frame and whose `id` is the original Figma text node id

#### Scenario: Unsupported input is rejected
- **WHEN** the user provides a design URL without a selected node id or a Make, FigJam, or Slides URL
- **THEN** the app returns an `unsupported_source` diagnostic explaining that a selected Figma design Frame link is required and makes no extraction call

### Requirement: Frame design context is built from real metadata
The system SHALL populate the design context hierarchy from structure returned by `get_metadata` for the selected Frame.

#### Scenario: Hierarchy mirrors selected Frame metadata
- **WHEN** an audit runs successfully for a Frame scope
- **THEN** its design context records real node ids, names, types, and parent relationships returned for that Frame

### Requirement: MCP readiness and node failures are visible
The system SHALL surface read failures without inventing source copy.

#### Scenario: MCP disconnected at audit time
- **WHEN** the user runs audit while Figma MCP is not connected
- **THEN** the audit response and persisted session carry an `mcp_not_ready` diagnostic, no text nodes are produced, and no review changes are generated

#### Scenario: One text node fails during extraction
- **WHEN** a Frame contains multiple text nodes and one MCP design-context read fails
- **THEN** valid siblings are extracted, the failed node is omitted, and a `partial_read_failure` warning is shown
