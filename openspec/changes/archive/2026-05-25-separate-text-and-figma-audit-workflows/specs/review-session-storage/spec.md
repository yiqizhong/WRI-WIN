## ADDED Requirements

### Requirement: Figma audit sessions provide batch-level history

The system SHALL make persisted Figma audit runs available as Audit Log
entries, with exactly one entry per run/Batch containing stable identity,
Product, target-object summary, Label, lifecycle status, and created or
updated time information.

#### Scenario: Completed Figma audit appears as one log row

- **GIVEN** a Figma audit run has been created for a Product and Figma target
- **WHEN** the desktop client requests Audit Log history
- **THEN** the returned history contains one entry for that Batch
- **AND** the entry supplies Product, target summary, Batch identity, Label,
  status, and time display data

#### Scenario: Batch with multiple findings remains one row

- **GIVEN** a completed Figma audit Batch contains multiple findings or text nodes
- **WHEN** the Audit Log history is listed
- **THEN** that Batch is represented by one log entry rather than one entry per finding or node

### Requirement: Failed created batches remain traceable

The system SHALL persist and list a Figma Audit Batch that was created before
its extraction or audit operation failed, with a failure status suitable for
the Audit Log.

#### Scenario: Audit fails after batch creation

- **GIVEN** a Batch identity has been created for an audit request
- **WHEN** extraction, MCP access, or audit execution fails
- **THEN** the persisted Batch is available in Audit Log history with failed status
- **AND** the failure does not create an approved writeback action

### Requirement: Batch identity loads audit detail state

The system SHALL use the listed Batch identity to retrieve the persisted
findings, rewrites, approval decisions, exports, and changelog associated with
that Figma audit session.

#### Scenario: Load selected batch detail

- **GIVEN** an Audit Log entry identifies an existing Figma audit Batch
- **WHEN** the desktop client requests detail for that Batch
- **THEN** the daemon returns the associated review state using its stable session/run identity
