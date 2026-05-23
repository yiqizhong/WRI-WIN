# review-session-storage Specification

## Purpose

Define local persistence for projects, review sessions, and audit records.

## Requirements

### Requirement: Projects persist locally
The system SHALL persist local project metadata so the active project can be reopened after app restart.

#### Scenario: Reopen active project
- **WHEN** the user restarts the desktop app after opening a project
- **THEN** the app can restore the active project metadata from local storage

### Requirement: Review sessions persist source and run metadata
The system SHALL persist review session metadata including source type, scope, agent run IDs, approval decisions, and generated artifacts.

#### Scenario: Store review session metadata
- **WHEN** a review session is created
- **THEN** the daemon stores its source type, scope, timestamps, status, and related run identifiers

### Requirement: Audit log records platform decisions
The system SHALL record permission decisions, agent run lifecycle events, and write-capable tool attempts in a local audit log.

#### Scenario: Permission decision is recorded
- **WHEN** the user approves or denies a write-capable tool request
- **THEN** the daemon records the decision with actor, timestamp, tool, request ID, and result
