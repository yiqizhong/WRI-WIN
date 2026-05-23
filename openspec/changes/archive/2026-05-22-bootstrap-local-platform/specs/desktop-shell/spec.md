## ADDED Requirements

### Requirement: Desktop app launches a local workspace shell
The system SHALL provide an Electron desktop app that launches in development and presents the primary workspace shell.

#### Scenario: Launch desktop app
- **WHEN** the user starts the desktop app in development
- **THEN** the app displays navigation, a workspace area, and settings entry points

### Requirement: Desktop app displays daemon connection status
The desktop app SHALL show whether the local daemon is connected, unavailable, or in an error state.

#### Scenario: Daemon unavailable
- **WHEN** the daemon cannot be reached
- **THEN** the desktop app shows an unavailable state with a user-readable recovery message

### Requirement: Desktop app delegates privileged operations
The desktop app SHALL delegate local filesystem, agent, MCP, and write operations to the daemon instead of performing them directly in the renderer.

#### Scenario: User selects a local folder
- **WHEN** the user chooses a local project folder from the desktop UI
- **THEN** the desktop app sends the request through the daemon/client boundary and receives a stored project result

