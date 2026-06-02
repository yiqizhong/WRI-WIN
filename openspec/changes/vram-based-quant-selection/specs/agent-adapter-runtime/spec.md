## ADDED Requirements

### Requirement: detectNvidiaVram exports total VRAM of primary CUDA device

The local Gemma adapter SHALL export a `detectNvidiaVram(): Promise<number | null>` function that runs `llama-cli --list-devices`, parses the total MiB from the primary CUDA device line (`CUDA0: ... (NNNN MiB, ...)`), and returns that value, or `null` when no CUDA device is present, the MiB cannot be parsed, or the probe fails to spawn.

#### Scenario: 12 GB NVIDIA GPU detected

- **WHEN** `llama-cli --list-devices` outputs a `CUDA0` line with `(12288 MiB, ...)`
- **THEN** `detectNvidiaVram()` returns `12288`

#### Scenario: No NVIDIA GPU (CPU-only output)

- **WHEN** `llama-cli --list-devices` outputs no `CUDA0` line
- **THEN** `detectNvidiaVram()` returns `null`

#### Scenario: Malformed CUDA line returns null

- **WHEN** the `CUDA0` line does not contain a parseable MiB value
- **THEN** `detectNvidiaVram()` returns `null`

#### Scenario: Probe spawn failure returns null

- **WHEN** the `llama-cli` binary cannot be spawned
- **THEN** `detectNvidiaVram()` returns `null`

#### Scenario: Result is cached for daemon session

- **WHEN** `detectNvidiaVram()` is called multiple times in the same daemon session
- **THEN** the probe process is spawned only once
- **AND** subsequent calls return the cached value without re-spawning

#### Scenario: Existing listGpuDevices behavior preserved

- **WHEN** `listGpuDevices()` is called after adding VRAM parsing
- **THEN** it continues to return the same string-list result as before
