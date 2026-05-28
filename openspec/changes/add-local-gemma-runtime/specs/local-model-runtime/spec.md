## ADDED Requirements

### Requirement: Local Gemma model catalog entry

The desktop app SHALL expose Gemma 4 E4B as a local model option that is not preinstalled with the application bundle.

#### Scenario: Model appears before download

- **WHEN** the user opens the Local Models surface
- **THEN** Gemma 4 E4B appears as an available local model download
- **AND** the app shows that the model is not installed yet

#### Scenario: Model weights are not bundled

- **WHEN** the app is installed before the user downloads Gemma 4 E4B
- **THEN** the application bundle MUST NOT include the Gemma 4 E4B model weight artifact

### Requirement: Approved model download

The daemon SHALL download Gemma 4 E4B only from an approved model artifact source and SHALL report download progress to the desktop app.

#### Scenario: User starts model download

- **WHEN** the user clicks Download for Gemma 4 E4B
- **THEN** the desktop requests the daemon to start the approved model download
- **AND** the daemon records the model as downloading
- **AND** the desktop can show progress, failure, and retry states

#### Scenario: Download does not send business data

- **WHEN** the daemon downloads the Gemma 4 E4B model artifact
- **THEN** the download request MUST NOT include project files, prompts, knowledge base content, model outputs, or other business data

### Requirement: Model artifact verification and install

The daemon SHALL verify the downloaded Gemma 4 E4B artifact before marking it installed and available for local inference.

#### Scenario: Verified artifact installs

- **WHEN** the model artifact download completes
- **AND** checksum or manifest verification succeeds
- **THEN** the daemon stores the model in the app-managed local model store
- **AND** marks Gemma 4 E4B as installed

#### Scenario: Verification failure blocks install

- **WHEN** the model artifact download completes
- **AND** checksum or manifest verification fails
- **THEN** the daemon marks the model install as failed
- **AND** does not expose the model as ready for inference

### Requirement: Local-only inference boundary

The Gemma 4 E4B runtime SHALL perform inference locally and MUST NOT call third-party inference APIs, Ollama, LM Studio, OpenAI-compatible external endpoints, or public local serving APIs.

#### Scenario: Inference after network disconnect

- **WHEN** Gemma 4 E4B is installed
- **AND** the machine is disconnected from the network
- **THEN** the local Gemma runtime can still complete a basic text request

#### Scenario: Runtime does not use external inference

- **WHEN** the daemon runs a prompt through the local Gemma runtime
- **THEN** prompt text, project knowledge, input documents, and generated output remain in the app-managed local environment
- **AND** the daemon does not send them to third-party services

### Requirement: Local inference process management

The daemon SHALL manage the local Gemma inference runtime lifecycle without requiring the user to install or operate external model software.

#### Scenario: Runtime starts on demand

- **WHEN** the user runs a request with Local Gemma selected
- **AND** Gemma 4 E4B is installed
- **THEN** the daemon starts or reuses the app-managed local inference runtime
- **AND** the user does not need to run a terminal command or start a separate service

#### Scenario: Runtime startup failure is visible

- **WHEN** the daemon cannot start the local inference runtime
- **THEN** the desktop shows a visible failure state
- **AND** the model is not treated as ready for successful inference
