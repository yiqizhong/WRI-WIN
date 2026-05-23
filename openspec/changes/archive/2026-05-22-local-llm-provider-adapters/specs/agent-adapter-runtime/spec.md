## MODIFIED Requirements

### Requirement: Agent adapters report availability and capabilities
The system SHALL define an agent adapter contract that reports detection status, executable path when available, supported capabilities, runtime kind (local or hybrid), and setup guidance when unavailable.

#### Scenario: List available agents
- **WHEN** the desktop app requests available agents
- **THEN** the daemon returns each adapter with availability, display name, setup status, runtime kind, and capability metadata

#### Scenario: Refresh detection on demand
- **WHEN** the desktop or daemon requests agent detection refresh
- **THEN** the daemon re-runs adapter detection and returns updated availability without restarting the daemon

### Requirement: Agent adapters run review prompts through normalized events
The agent runtime SHALL execute a local agent run using the selected provider adapter (Cursor, Codex, Claude Code, Devin, or echo) and stream normalized events for text output, tool requests, errors, cancellation, and completion.

#### Scenario: Run a simple review prompt with Claude Code
- **WHEN** the user starts a copy review run with the Claude Code adapter and an available session
- **THEN** the daemon streams normalized run events from the Claude CLI until the run completes, fails, or is canceled

#### Scenario: Unavailable adapter rejected at run start
- **WHEN** the user starts a run with an adapter that is not available
- **THEN** the daemon rejects the request with an error explaining setup steps
