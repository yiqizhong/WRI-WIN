## MODIFIED Requirements

### Requirement: Provider adapters detect local installation and auth readiness
The system SHALL provide agent adapters for Cursor Agent, Codex, Claude Code, and Devin that report whether the local interface is installed, executable, authenticated when applicable, and ready to accept prompts.

#### Scenario: Cursor detected on PATH
- **WHEN** the daemon refreshes agent detection and the Cursor CLI is installed and invocable
- **THEN** the `cursor-agent` adapter reports `available: true` with executable path metadata and a ready diagnostic

#### Scenario: Claude not installed
- **WHEN** the Claude Code CLI is not found
- **THEN** the `claude-code` adapter reports `available: false` with setup instructions to install or fix PATH

#### Scenario: Devin needs login
- **WHEN** the Devin CLI is installed but authentication is missing
- **THEN** the `devin` adapter reports `available: false` with setup instructions referencing Devin login

#### Scenario: Codex wrapper is broken
- **WHEN** the Codex wrapper is found on PATH but `codex --version` fails because the vendor binary cannot be spawned
- **THEN** the `codex` adapter reports `available: false` with a `broken_executable` diagnostic and reinstall guidance

### Requirement: Users can smoke-test a provider connection
The daemon SHALL support a short smoke probe that verifies a selected adapter can return model output without starting a full review workflow and returns structured diagnostic detail on failure.

#### Scenario: Successful smoke test
- **WHEN** the user requests a smoke test for an available adapter
- **THEN** the daemon returns success with truncated output text, adapter ID, command path, and ready diagnostic within a bounded timeout

#### Scenario: Smoke test failure
- **WHEN** the smoke test fails due to auth, timeout, CLI spawn error, or non-zero exit
- **THEN** the daemon returns a structured error with diagnostic code, message, recovery action, and bounded stdout/stderr snippets suitable for the desktop UI
