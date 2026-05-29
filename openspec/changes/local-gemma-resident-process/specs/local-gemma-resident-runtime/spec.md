# Spec: local-gemma-resident-runtime

## ADDED Requirements

### Requirement: Resident model process

The runtime SHALL keep at most one `llama-cli` conversation process resident and
reuse it across agent runs while the model is loaded.

#### Scenario: Second run reuses the warm process

WHEN a run completes AND a second run starts before idle eviction
THEN the runtime SHALL reuse the existing process without reloading the model.

#### Scenario: First run cold-starts the process

WHEN the runtime has no live process AND a run starts
THEN the runtime SHALL spawn a new `llama-cli -cnv` process and load the model once.

### Requirement: Serialized turns

The runtime SHALL run at most one turn at a time and queue additional runs.

#### Scenario: Concurrent runs are serialized

WHEN two runs are requested while one is in flight
THEN the runtime SHALL complete them one at a time in arrival order.

### Requirement: Turn response extraction

The runtime SHALL return, for each turn, only that turn's response text — without
the prompt echo, thinking trace, or per-turn stats footer.

#### Scenario: Turn returns clean text

WHEN a turn produces "> <user>\n<answer>\n[ Prompt: ... ]"
THEN the run result SHALL contain only "<answer>".

### Requirement: Idle eviction

The runtime SHALL terminate the resident process after an idle period, releasing
VRAM, unless eviction is disabled.

#### Scenario: Evict after idle timeout

WHEN no run occurs for longer than the idle timeout AND eviction is enabled
THEN the runtime SHALL terminate the process and free VRAM.

#### Scenario: Eviction disabled

WHEN `WRITER_LOCAL_IDLE_MS` is "0"
THEN the runtime SHALL keep the process resident indefinitely.

### Requirement: Crash recovery

The runtime SHALL detect unexpected process exit and cold-start a new process on
the next run.

#### Scenario: Respawn after crash

WHEN the resident process exits unexpectedly AND a new run starts
THEN the runtime SHALL spawn a fresh process and complete the run.

### Requirement: Per-turn timeout

The runtime SHALL fail a turn that produces no completion within a timeout, rather
than hang indefinitely.

#### Scenario: Turn times out

WHEN a turn produces no footer within the per-turn timeout
THEN the runtime SHALL emit an error event for that run and recover for the next.
