## ADDED Requirements

### Requirement: Deterministic flash attention

The Local Gemma runtime SHALL enable flash attention explicitly rather than relying on the inference binary's automatic default, and SHALL allow an environment override. Flash attention SHALL NOT change generated output content.

#### Scenario: Flash attention on by default

- **WHEN** the Local Gemma runtime starts an inference process and no override is set
- **THEN** it spawns with flash attention explicitly enabled

#### Scenario: Flash attention override

- **WHEN** `WRITER_LOCAL_FLASH_ATTN` is set to `on`, `off`, or `auto`
- **THEN** the runtime spawns with that flash-attention setting
- **AND** an unrecognized value falls back to the default (`on`)

### Requirement: Configurable prompt-processing batch size

The Local Gemma runtime SHALL set the physical prompt-processing batch size to improve prefill throughput, with an environment override, applied consistently to the resident process and the cold-spawn fallback.

#### Scenario: Default batch size raised above the binary default

- **WHEN** the runtime starts an inference process and no override is set
- **THEN** it spawns with a physical batch size of 1024

#### Scenario: Batch size override

- **WHEN** `WRITER_LOCAL_UBATCH` is set to a valid positive integer
- **THEN** the runtime spawns with that physical batch size

#### Scenario: Invalid batch override falls back

- **WHEN** `WRITER_LOCAL_UBATCH` is unset or not a valid positive integer
- **THEN** the runtime uses the default physical batch size (1024)

### Requirement: Per-turn throughput logging

The Local Gemma runtime SHALL be able to report per-turn throughput (prompt-eval and generation tokens per second) parsed from the inference binary's turn footer, gated behind an opt-in flag and disabled by default.

#### Scenario: Throughput logged when enabled

- **WHEN** `WRITER_LOCAL_PERF_LOG=1` and a turn completes with a recognizable footer
- **THEN** the runtime logs the turn's prompt-eval and generation tokens-per-second

#### Scenario: No logging by default

- **WHEN** `WRITER_LOCAL_PERF_LOG` is unset
- **THEN** the runtime does not emit throughput logs
- **AND** turn behavior is unchanged

#### Scenario: Unrecognized footer does not fail the turn

- **WHEN** the turn footer cannot be parsed for throughput metrics
- **THEN** the metrics parser returns empty values
- **AND** the turn still returns its response normally
