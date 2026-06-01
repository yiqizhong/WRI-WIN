## ADDED Requirements

### Requirement: Text workflow provides rewrite-only interaction

The system SHALL provide a dedicated Text workflow in which a user can submit
text for LLM rewrite and receive rewritten text, and it SHALL NOT treat Text
messages as Figma audit runs or Figma writeback requests.

#### Scenario: Paste text for rewrite

- **GIVEN** the user has opened the Text workflow
- **WHEN** the user submits pasted text
- **THEN** the system returns rewritten text through the conversation flow
- **AND** no Figma Audit Log Batch is created for that message

### Requirement: Text rewrite always uses global writing context

Every Text rewrite request MUST use the configured company-based and
software-writing context assembled by the daemon before the LLM run begins.

#### Scenario: Rewrite without a selected product

- **GIVEN** global company-based and software-writing configuration is available
- **AND** the user has not selected a specific Product
- **WHEN** the user submits text for rewrite
- **THEN** the rewrite runs using the global writing context
- **AND** product-specific context is not required

#### Scenario: Required global context cannot be loaded

- **GIVEN** mandatory company-based or software-writing configuration cannot be loaded
- **WHEN** the user attempts a Text rewrite
- **THEN** the system displays a clear failure for the rewrite request
- **AND** MUST NOT silently run an ungrounded rewrite

### Requirement: Product context is an optional Text enhancement

The Text workflow SHALL allow a user to leave the Product unset or to select
one specific Product; when selected, the daemon MUST append that Product's
available background, glossary, and writing-guide context to the mandatory
global writing context.

#### Scenario: Rewrite with a selected product

- **GIVEN** the user selects a readable Product in the Text workflow
- **WHEN** the user submits text for rewrite
- **THEN** the daemon assembles global writing context plus the selected Product context
- **AND** the rewrite response remains part of the Text conversation

#### Scenario: Selected product context is unreadable

- **GIVEN** the user selects a Product whose context cannot be read or validated
- **WHEN** the user attempts a Text rewrite
- **THEN** the system reports the Product context problem
- **AND** MUST NOT silently execute as though no Product were selected

### Requirement: Supported attachments remain text workflow input

The Text workflow SHALL continue to accept its supported CSV/XLSX attachment
input for rewrite operations, and attachment-based rewrites SHALL remain
isolated from Figma Audit history.

#### Scenario: Rewrite attached tabular copy

- **GIVEN** the user is in the Text workflow
- **WHEN** the user attaches a supported CSV or XLSX input and requests a rewrite
- **THEN** the system processes the supported attachment within the Text conversation
- **AND** no Figma Audit Log Batch is created for the attachment or rewrite
