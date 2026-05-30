## ADDED Requirements

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
