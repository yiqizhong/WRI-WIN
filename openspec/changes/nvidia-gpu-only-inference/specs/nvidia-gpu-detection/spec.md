# Spec: nvidia-gpu-detection

## ADDED Requirements

### Requirement: GPU presence check

The local-gemma adapter SHALL check for NVIDIA GPU availability before reporting
itself as available, unless the `WRITER_GPU_LAYERS` environment variable is set to
a non-empty value other than `"0"`.

#### Scenario: NVIDIA GPU present

WHEN `detect()` is called AND `nvidia-smi` exits with code 0
THEN the adapter SHALL proceed to report `available: true` (subject to binary and model checks).

#### Scenario: NVIDIA GPU absent

WHEN `detect()` is called AND `nvidia-smi` exits non-zero AND `WRITER_GPU_LAYERS` is not set
THEN the adapter SHALL return `available: false` with `diagnostic.code = "gpu_not_available"`.

#### Scenario: WRITER_GPU_LAYERS override

WHEN `detect()` is called AND `WRITER_GPU_LAYERS` is set to a non-zero numeric string
THEN the adapter SHALL skip the `nvidia-smi` check and treat GPU as present.

### Requirement: GPU layer offload in spawn

The local-gemma adapter SHALL pass `-ngl <layers>` to every `llama-cli` invocation,
where `<layers>` is `WRITER_GPU_LAYERS` if set, otherwise `"99"`.

#### Scenario: Default full offload

WHEN `run()` spawns `llama-cli` AND `WRITER_GPU_LAYERS` is not set
THEN the spawn args SHALL include `"-ngl"` and `"99"`.

#### Scenario: Override via env var

WHEN `run()` spawns `llama-cli` AND `WRITER_GPU_LAYERS` is `"64"`
THEN the spawn args SHALL include `"-ngl"` and `"64"`.

### Requirement: gpu_not_available diagnostic code

The `ConnectionDiagnosticCode` type in `@writer/contracts` SHALL include the value
`"gpu_not_available"`.

#### Scenario: Diagnostic code is valid

WHEN the local-gemma adapter returns `diagnostic.code = "gpu_not_available"`
THEN the value SHALL be assignable to `ConnectionDiagnosticCode` without a type error.
