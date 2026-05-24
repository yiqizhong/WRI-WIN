## ADDED Requirements

### Requirement: Figma MCP client is callable from the review pipeline
The daemon SHALL expose the connected Figma MCP client to the review pipeline via a typed `McpCaller` adapter so that review extraction can invoke discovered Figma MCP tools (initially `get_metadata` and `get_design_context`) without depending directly on daemon-internal client wiring.

#### Scenario: Review pipeline calls get_metadata
- **WHEN** the review pipeline runs an audit on a figma session and the Figma MCP server is connected
- **THEN** the daemon invokes `state.mcp.figmaClient.callTool("get_metadata", { fileKey, nodeId })` via the McpCaller adapter and receives the structured MCP result

#### Scenario: McpCaller status reflects MCP server state
- **WHEN** the review pipeline checks `mcpCaller.status` while the Figma MCP server is disconnected
- **THEN** the value is `disconnected` and the pipeline returns the `mcp_not_ready` diagnostic without attempting any tool calls
