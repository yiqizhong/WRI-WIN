# agent-llm-providers Specification

## Purpose

Define concrete local LLM provider adapters for Cursor Agent and Devin.

## Requirements

### Requirement: Provider adapters detect local installation and auth readiness
The system SHALL provide agent adapters for Cursor Agent and Devin that report whether the local interface is installed, executable, and ready to accept prompts.

#### Scenario: Cursor detected on PATH
- **WHEN** the daemon refreshes agent detection and the Cursor CLI is installed and invocable
- **THEN** the `cursor-agent` adapter reports `available: true` with executable path metadata

#### Scenario: Cursor not installed
- **WHEN** the Cursor CLI is not found
- **THEN** the `cursor-agent` adapter reports `available: false` with setup instructions to install or fix PATH

#### Scenario: Devin needs login
- **WHEN** the Devin CLI is installed but authentication is missing
- **THEN** the `devin` adapter reports `available: false` with setup instructions referencing Devin login

### Requirement: Provider adapters expose runtime kind metadata
Each provider adapter SHALL include capability metadata indicating whether execution is local-only or hybrid (local CLI with cloud inference).

#### Scenario: Devin hybrid metadata
- **WHEN** the desktop lists the Devin adapter
- **THEN** capability metadata indicates hybrid runtime so the UI can label cloud-backed execution

### Requirement: Users can smoke-test a provider connection
The daemon SHALL support a short smoke probe that verifies a selected adapter can return model output without starting a full review workflow.

#### Scenario: Successful smoke test
- **WHEN** the user requests a smoke test for an available adapter
- **THEN** the daemon returns success with truncated output text within a bounded timeout

#### Scenario: Smoke test failure
- **WHEN** the smoke test fails due to auth, timeout, or CLI error
- **THEN** the daemon returns a structured error with a recoverable message suitable for the desktop UI

### Requirement: Provider adapters execute review prompts with normalized streaming
Each implemented provider adapter SHALL run a non-interactive prompt, emit normalized `text` and `error` run events, and support cancellation of the underlying process.

#### Scenario: Stream text from Cursor Agent run
- **WHEN** the user starts an agent run with the Cursor Agent adapter and a review prompt
- **THEN** the daemon persists streaming `text` events until the run completes or fails

#### Scenario: Cancel in-flight Cursor Agent run
- **WHEN** the user cancels an active Cursor Agent run
- **THEN** the underlying process is terminated and the run status becomes `canceled`
