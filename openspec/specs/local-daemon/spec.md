# local-daemon Specification

## Purpose

Define the private local daemon that owns privileged platform operations for Writer.

## Requirements

### Requirement: Daemon exposes health and capability status
The daemon SHALL expose a private local health endpoint that returns status, version, and capability summary.

#### Scenario: Desktop checks daemon health
- **WHEN** the desktop app requests daemon health
- **THEN** the daemon returns running status, version, enabled capabilities, and degraded capability errors if present

### Requirement: Daemon owns privileged platform operations
The daemon SHALL own local filesystem writes, project/session persistence, agent launch, MCP lifecycle, tool execution, permission decisions, and audit logging.

#### Scenario: Renderer requests privileged work
- **WHEN** the renderer requests an operation that touches local files, agents, MCP, tools, or writeback
- **THEN** the operation is executed by the daemon or rejected by the daemon with a structured error

### Requirement: Daemon returns structured errors
The daemon SHALL return structured, user-readable errors for unavailable services, failed subprocesses, invalid requests, and permission denials.

#### Scenario: Agent CLI is missing
- **WHEN** an agent adapter points to a missing CLI
- **THEN** the daemon returns an error that identifies the missing command and includes setup guidance
