## MODIFIED Requirements

### Requirement: Agent adapters run review prompts through normalized events

The agent runtime SHALL execute a local agent run using the selected provider adapter (Cursor, Codex, Claude Code, Devin, echo, or Local Gemma) and stream normalized events for text output, tool requests, errors, cancellation, and completion.

#### Scenario: Run a simple review prompt with Claude Code

- **WHEN** the user starts a copy review run with the Claude Code adapter and an available session
- **THEN** the daemon streams normalized run events from the Claude CLI until the run completes, fails, or is canceled

#### Scenario: Run a basic prompt with Local Gemma

- **WHEN** the user starts a basic text request with the Local Gemma adapter selected
- **AND** Gemma 4 E4B is installed and the app-managed local inference runtime is available
- **THEN** the daemon streams normalized text events from local inference until the run completes, fails, or is canceled

#### Scenario: Unavailable adapter rejected at run start

- **WHEN** the user starts a run with an adapter that is not available
- **THEN** the daemon rejects the request with an error explaining setup steps

#### Scenario: Local Gemma unavailable before install

- **WHEN** the user starts a run with Local Gemma selected before Gemma 4 E4B is installed
- **THEN** the daemon rejects the request with an error explaining that the local model must be downloaded first
