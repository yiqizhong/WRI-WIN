## ADDED Requirements

### Requirement: Review pipeline invokes typed Frame read tools
The daemon SHALL expose connected Figma MCP read calls to the review pipeline through a typed adapter without making review-core depend on daemon-internal client state.

#### Scenario: Audit calls metadata and design context
- **WHEN** a Frame audit runs while Figma MCP is connected
- **THEN** the daemon adapter invokes `get_metadata` for the selected Frame and `get_design_context` for discovered text nodes

#### Scenario: Adapter reflects disconnected status
- **WHEN** Figma MCP is disconnected
- **THEN** extraction returns `mcp_not_ready` without invoking MCP tools

### Requirement: Daemon owns permission-gated Frame write tools
The daemon SHALL invoke Figma MCP `use_figma` for approved text replacement only after its existing `figma.write` permission gate authorizes the apply operation.

#### Scenario: Write permission is not approved
- **WHEN** the user requests apply but has not granted required write permission
- **THEN** the daemon requests permission and performs no `use_figma` invocation

#### Scenario: Write permission is approved
- **WHEN** permission has been granted for eligible changes in the Frame session
- **THEN** the daemon invokes `use_figma` with operations targeted at the original text node ids and records its result
