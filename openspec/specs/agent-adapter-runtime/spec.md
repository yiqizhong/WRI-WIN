# agent-adapter-runtime Specification

## Purpose

Define the daemon-owned agent adapter contract and normalized run event model.
## Requirements
### Requirement: Agent adapters report availability and capabilities
The system SHALL define an agent adapter contract that reports detection status, executable path when available, supported capabilities, runtime kind (local or hybrid), setup guidance when unavailable, and the latest structured connection diagnostic.

#### Scenario: List available agents
- **WHEN** the desktop app requests available agents
- **THEN** the daemon returns each adapter with availability, display name, setup status, runtime kind, capability metadata, and diagnostic state

#### Scenario: Refresh detection on demand
- **WHEN** the desktop or daemon requests agent detection refresh
- **THEN** the daemon re-runs adapter detection and returns updated availability and diagnostics without restarting the daemon

#### Scenario: Broken local CLI is reported
- **WHEN** an adapter command is found but its version probe fails because an underlying executable is missing
- **THEN** the adapter is unavailable and includes a `broken_executable` diagnostic with path and repair guidance

### Requirement: Agent adapters run review prompts through normalized events
The agent runtime SHALL execute a local agent run using the selected provider adapter (Cursor, Codex, Claude Code, Devin, or echo) and stream normalized events for text output, tool requests, errors, cancellation, and completion.

#### Scenario: Run a simple review prompt with Claude Code
- **WHEN** the user starts a copy review run with the Claude Code adapter and an available session
- **THEN** the daemon streams normalized run events from the Claude CLI until the run completes, fails, or is canceled

#### Scenario: Unavailable adapter rejected at run start
- **WHEN** the user starts a run with an adapter that is not available
- **THEN** the daemon rejects the request with an error explaining setup steps

### Requirement: Agent runs can be canceled
The agent runtime SHALL support cancellation of an in-flight local CLI process.

#### Scenario: Cancel active run
- **WHEN** the user cancels an active agent run
- **THEN** the daemon stops the process, records cancellation, and emits a canceled run event

### Requirement: Local runtime context window from manifest

The Local Gemma runtime SHALL size its inference context window from the model manifest's declared default context rather than a hardcoded value, and SHALL allow an environment override. The resolved context size SHALL be applied consistently to both the resident process and the cold-spawn fallback, and SHALL be the basis for prompt token budgeting.

#### Scenario: Context size sourced from manifest

- **WHEN** the Local Gemma runtime starts an inference process and no override is set
- **THEN** it spawns with a context size equal to the manifest's `defaultContext`
- **AND** the same size is used whether the resident process or the cold-spawn fallback is used

#### Scenario: Environment override respected

- **WHEN** `WRITER_LOCAL_CTX_SIZE` is set to a valid positive integer
- **THEN** the runtime spawns with that context size instead of the manifest default

#### Scenario: Invalid override falls back

- **WHEN** `WRITER_LOCAL_CTX_SIZE` is unset or not a valid positive integer
- **THEN** the runtime uses the manifest `defaultContext`

### Requirement: KV cache precision with VRAM fallback

The Local Gemma runtime SHALL run with full-precision (FP16) KV cache by default to preserve generation speed, and SHALL fall back to quantized KV cache when the larger context window cannot be allocated in available VRAM. An explicit precision override SHALL disable the automatic fallback.

#### Scenario: FP16 by default

- **WHEN** the runtime starts with no KV precision override
- **THEN** it attempts to load with FP16 KV cache first

#### Scenario: Fallback to quantized KV on VRAM failure

- **WHEN** the FP16 load fails because the context window cannot be allocated in VRAM
- **THEN** the runtime retries once with q8_0 KV cache
- **AND** remembers the quantized precision for subsequent (re)starts in the same runtime lifetime

#### Scenario: Explicit precision override

- **WHEN** `WRITER_LOCAL_KV_TYPE` is set to a supported precision
- **THEN** the runtime spawns with that precision
- **AND** does not perform the automatic FP16-to-quantized fallback

### Requirement: New conversation resets local model context

The Local Gemma runtime SHALL treat a change of active conversation as a context boundary, restarting the resident process so a new conversation begins with an empty model KV cache and does not inherit context from a previous conversation.

#### Scenario: New chat starts at zero context

- **WHEN** an inference turn arrives for a different conversation/session than the resident process last served
- **THEN** the runtime restarts the process before running the turn
- **AND** the turn executes against an empty model KV cache

#### Scenario: Same conversation reuses the warm process

- **WHEN** consecutive turns belong to the same conversation/session and the system prompt and turn budget are unchanged
- **THEN** the runtime reuses the resident process without restarting

