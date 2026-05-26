## MODIFIED Requirements

### Requirement: Agent adapters report availability and capabilities
The system SHALL define an agent adapter contract that reports detection status, executable path when available, supported capabilities, runtime kind (local or hybrid), setup guidance when unavailable, and the latest structured connection diagnostic.

#### Scenario: List available agents
- **WHEN** the desktop app requests available agents
- **THEN** the daemon returns each adapter with availability, display name, setup status, runtime kind, capability metadata, and diagnostic state

#### Scenario: Refresh detection on demand
- **WHEN** the desktop or daemon requests agent detection refresh
- **THEN** the daemon re-runs adapter detection and returns updated availability and diagnostics without restarting the daemon

#### Scenario: Broken local CLI is reported
- **WHEN** an adapter command is found but its version probe fails because an underlying executable is missing
- **THEN** the adapter is unavailable and includes a `broken_executable` diagnostic with path and repair guidance
