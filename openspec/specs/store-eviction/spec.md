# store-eviction Specification

## Purpose
TBD - created by archiving change platform-store-eviction. Update Purpose after archive.
## Requirements
### Requirement: Purge agent run events on completion

Terminal agent runs SHALL not leave event rows in `platform-store.json`.

#### Scenario: Events removed after consume

- **WHEN** an agent run reaches status `completed`, `failed`, or `canceled` and `consumeAgentRun` finishes
- **THEN** `purgeAgentRunEvents(runId)` removes all events for that run from the snapshot
- **AND** the subsequent `store.save()` omits those events

#### Scenario: Cancel purges events

- **WHEN** `cancelAgentRun` completes for a run
- **THEN** events for that `runId` are purged before save

### Requirement: purgeAgentRunEvents store API

The storage layer SHALL expose explicit event purge for a run id.

#### Scenario: Purge filters by runId

- **WHEN** `PlatformStore.purgeAgentRunEvents(runId)` is called
- **THEN** `agentRunEvents` retains only events whose `runId` does not match

### Requirement: Audit log FIFO cap

The audit log SHALL not grow without bound.

#### Scenario: Cap at ten thousand entries

- **WHEN** `appendAuditEntry` would make `auditLog.length` exceed 10_000
- **THEN** oldest entries are removed until length is 10_000

### Requirement: Agent run prompt not persisted

New agent runs SHALL not store the assembled prompt in the platform store.

#### Scenario: CLI adapter omits prompt

- **WHEN** `runCliAdapter` creates an `AgentRun` for persistence
- **THEN** the object passed to `upsertAgentRun` does not include `prompt`

#### Scenario: AgentRun schema allows legacy prompt

- **WHEN** `agentRunSchema` validates a record
- **THEN** `prompt` is optional
- **AND** newly written runs do not set `prompt`

### Requirement: Load migration purges stale events

Stores with events for already-terminal runs SHALL be cleaned on load.

#### Scenario: Terminal runs lose events at load

- **WHEN** `store.load()` reads `agentRunEvents` for runs already in terminal status
- **THEN** those events are removed in memory and saved once after migration

