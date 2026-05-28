## ADDED Requirements

### Requirement: Minimal pasted API key setup

The desktop app SHALL provide a minimal setup path where a user can paste an API key for one supported BYOK provider preset without entering a base URL, protocol, or model name.

#### Scenario: User pastes provider API key

- **WHEN** the user opens the model/runtime settings surface
- **AND** chooses the BYOK API option for the supported V1 preset
- **AND** pastes a non-empty API key
- **THEN** the app accepts the pasted key for validation without requiring additional provider fields

#### Scenario: Empty key is rejected

- **WHEN** the user attempts to test or save the BYOK API option with an empty API key
- **THEN** the app rejects the request with a visible validation message
- **AND** does not mark the BYOK runtime as ready

### Requirement: BYOK connection test

The daemon SHALL validate the pasted API key by making a minimal authenticated request to the supported V1 provider preset and returning a structured success or failure result to the desktop app.

#### Scenario: Valid key test succeeds

- **WHEN** the desktop submits a non-empty API key for the supported V1 preset
- **AND** the provider accepts the minimal test request
- **THEN** the daemon returns a success result with redacted provider configuration
- **AND** the desktop shows that the API runtime is ready to save or use

#### Scenario: Invalid key test fails visibly

- **WHEN** the desktop submits an invalid API key for the supported V1 preset
- **THEN** the daemon returns a failure result suitable for the UI
- **AND** the response does not include the raw API key

### Requirement: BYOK runtime selection

The system SHALL allow the validated BYOK API runtime to be saved locally and selected as the active model runtime alongside existing Cursor and Devin options.

#### Scenario: Save and select BYOK runtime

- **WHEN** the user saves a validated BYOK API configuration
- **THEN** the daemon persists the local runtime configuration
- **AND** the agent list exposes the BYOK runtime as selectable
- **AND** selecting it does not remove Cursor or Devin from the available runtime list

#### Scenario: Runtime list redacts secrets

- **WHEN** the desktop refreshes the runtime list or current BYOK configuration
- **THEN** returned metadata MUST NOT include the raw API key

### Requirement: Basic BYOK model request

The BYOK adapter SHALL complete a basic text model request using the saved pasted API key and emit normalized agent run text or error events through the existing run flow.

#### Scenario: Run basic request through BYOK

- **WHEN** the BYOK runtime is selected as active
- **AND** the user starts a basic text generation or paste-text chat request
- **THEN** the daemon sends the request through the supported provider preset using the saved API key
- **AND** the existing run flow receives normalized text events until completion

#### Scenario: BYOK run failure is visible

- **WHEN** the selected BYOK runtime cannot complete the provider request because of auth, network, or provider response failure
- **THEN** the daemon emits a normalized error event
- **AND** the desktop shows a visible failure state instead of silently stalling
