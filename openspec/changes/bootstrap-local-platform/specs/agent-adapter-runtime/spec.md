## ADDED Requirements

### Requirement: Agent adapters report availability and capabilities
The system SHALL define an agent adapter contract that reports detection status, executable path when available, and supported capabilities.

#### Scenario: List available agents
- **WHEN** the desktop app requests available agents
- **THEN** the daemon returns each adapter with availability, display name, setup status, and capability metadata

### Requirement: Agent adapters run review prompts through normalized events
The agent runtime SHALL execute a local agent run and stream normalized events for text output, tool requests, errors, cancellation, and completion.

#### Scenario: Run a simple review prompt
- **WHEN** the user starts a simple copy review run with an available adapter
- **THEN** the daemon streams normalized run events until the run completes, fails, or is canceled

### Requirement: Agent runs can be canceled
The agent runtime SHALL support cancellation of an in-flight local CLI process.

#### Scenario: Cancel active run
- **WHEN** the user cancels an active agent run
- **THEN** the daemon stops the process, records cancellation, and emits a canceled run event

