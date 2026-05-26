# tool-mcp-runtime Specification

## Purpose

Define Writer's tool registry, permission gates, and daemon-managed MCP lifecycle.
## Requirements
### Requirement: Tool registry exposes capability and risk metadata
The daemon SHALL maintain a tool registry where every tool declares name, source, capability, and risk level.

#### Scenario: Desktop lists tools
- **WHEN** the desktop app requests registered tools
- **THEN** the daemon returns tools classified as read-only, network, write, or destructive

### Requirement: Write and destructive tools require permission
The daemon SHALL require a permission decision before executing write or destructive tools.

#### Scenario: Agent requests a write tool
- **WHEN** an agent requests a write or destructive tool
- **THEN** the daemon creates a permission request and blocks execution until the user approves or denies it

### Requirement: MCP servers can be configured and managed
The system SHALL allow MCP servers to be added, enabled, disabled, removed, inspected, and connected through daemon-managed configuration and daemon-owned MCP client lifecycle.

#### Scenario: Configure Figma MCP
- **WHEN** the user enables a Figma MCP configuration
- **THEN** the daemon starts the MCP connection, initializes the server, discovers tools, and exposes connection status, diagnostics, and capabilities to the desktop app

#### Scenario: Figma MCP missing command
- **WHEN** the Figma MCP server is enabled but no command is configured
- **THEN** the daemon reports `not_configured` with a recovery action describing the required command/args configuration

#### Scenario: Figma MCP startup fails
- **WHEN** the configured Figma MCP process exits, times out, or fails initialization
- **THEN** the daemon reports an error diagnostic and keeps the desktop responsive

### Requirement: Figma MCP smoke path supports controlled read and write
The system SHALL provide a Figma MCP smoke path that can read file or node metadata through a discovered/configured MCP tool and perform one controlled write action only after permission.

#### Scenario: Run Figma read smoke
- **WHEN** the user runs a Figma read smoke with a configured and connected Figma MCP server
- **THEN** the daemon calls a configured or discovered read-capable Figma MCP tool and returns success, tool name, and bounded result metadata

#### Scenario: Read smoke has no compatible tool
- **WHEN** the Figma MCP server connects but no read-capable tool is configured or discovered
- **THEN** the daemon returns a `tool_not_found` diagnostic that includes the discovered tool names

#### Scenario: Run Figma write smoke
- **WHEN** the user runs a Figma smoke test with write permission approved
- **THEN** the system reads Figma metadata and performs the controlled write action while recording the result

### Requirement: Figma MCP client is callable from the review pipeline
The daemon SHALL expose the connected Figma MCP client to the review pipeline via a typed `McpCaller` adapter so that review extraction can invoke discovered Figma MCP tools (initially `get_metadata` and `get_design_context`) without depending directly on daemon-internal client wiring.

#### Scenario: Review pipeline calls get_metadata
- **WHEN** the review pipeline runs an audit on a figma session and the Figma MCP server is connected
- **THEN** the daemon invokes `state.mcp.figmaClient.callTool("get_metadata", { fileKey, nodeId })` via the McpCaller adapter and receives the structured MCP result

#### Scenario: McpCaller status reflects MCP server state
- **WHEN** the review pipeline checks `mcpCaller.status` while the Figma MCP server is disconnected
- **THEN** the value is `disconnected` and the pipeline returns the `mcp_not_ready` diagnostic without attempting any tool calls

