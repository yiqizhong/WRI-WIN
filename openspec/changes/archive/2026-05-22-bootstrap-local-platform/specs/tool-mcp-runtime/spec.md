## ADDED Requirements

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
The system SHALL allow MCP servers to be added, enabled, disabled, removed, and inspected through daemon-managed configuration.

#### Scenario: Configure Figma MCP
- **WHEN** the user enables a Figma MCP configuration
- **THEN** the daemon starts the MCP connection and exposes connection status and capabilities to the desktop app

### Requirement: Figma MCP smoke path supports controlled read and write
The system SHALL provide a Figma MCP smoke path that can read file or node metadata and perform one controlled write action after permission.

#### Scenario: Run Figma smoke test
- **WHEN** the user runs a Figma smoke test with write permission approved
- **THEN** the system reads Figma metadata and performs the controlled write action while recording the result

