# connection-diagnostics Specification

## Purpose
TBD - created by archiving change harden-local-cli-figma-mcp-connections. Update Purpose after archive.
## Requirements
### Requirement: Runtime connections expose structured diagnostics
The system SHALL represent local runtime connection state with stable diagnostic codes, severity, user-facing message, optional command metadata, optional output snippets, and a recommended recovery action.

#### Scenario: Broken executable is classified
- **WHEN** a runtime command is found on PATH but fails to spawn its underlying binary with `ENOENT`
- **THEN** the diagnostic code is `broken_executable` and the recovery action explains how to repair or reinstall the local tool

#### Scenario: Missing auth is classified
- **WHEN** a local runtime probe reports authentication, login, or unauthorized failure
- **THEN** the diagnostic code is `needs_auth` and the recovery action describes the login step

#### Scenario: Timeout is classified
- **WHEN** a runtime connection or smoke probe exceeds its bounded timeout
- **THEN** the diagnostic code is `timeout` and the output snippet records the timeout without hanging the daemon

### Requirement: Diagnostics are safe for desktop display
The system SHALL return diagnostic messages that are concise, actionable, and safe to show in the desktop app without exposing secrets.

#### Scenario: Secret-like values are not returned
- **WHEN** a diagnostic includes environment or command context
- **THEN** secret-bearing values such as access tokens and API keys MUST be omitted or redacted

#### Scenario: Desktop can render recovery guidance
- **WHEN** the desktop receives a diagnostic payload
- **THEN** it can display severity, message, recovery action, and command path without parsing free-form error text

