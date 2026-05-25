# review-session-storage Specification — Delta for `figma-audit-redesign`

> This delta extends the Figma review session record with user-supplied intent metadata (feature, description), optional product binding, frame screenshots, and a writeback report. Existing requirements remain.

## Modified Requirements

### Requirement: Figma review session shape

The system SHALL persist Figma review sessions with `featureName`, `description`, optional `productId`, optional `frameScreenshots`, and optional `writebackReport` in addition to existing fields.

#### Scenario: Create session with required intent metadata

- **WHEN** client sends `POST /review/sessions` with a Figma source and `{ featureName, description, productId? }`
- **THEN** daemon validates `featureName` and `description` are non-empty strings
- **AND** persists them on the session record
- **AND** validates `productId` (if provided) exists in the Guidelines tree; rejects unknown product

#### Scenario: Create session without product

- **WHEN** client sends the create request omitting `productId`
- **THEN** session is created with `productId: undefined`
- **AND** subsequent audit run injects only Company Base + Software Writing guideline layers into the Copywriter Skill prompt (Product layer omitted)

#### Scenario: Reject missing intent metadata

- **WHEN** client sends `POST /review/sessions` for a Figma source without `featureName` or with an empty `description`
- **THEN** daemon returns a 400-class error identifying the missing field
- **AND** session is not created

## Added Requirements

### Requirement: Frame screenshots on session record

The system SHALL store frame screenshots captured at audit completion on the session record as `frameScreenshots: Array<{ frameId: string, fileRef: string }>`, where `fileRef` is an absolute or workspace-relative path to a PNG file under the session's local screenshots directory.

#### Scenario: Session includes screenshots after audit completes

- **GIVEN** an audit run that finished successfully on a session whose scope covered N frames
- **WHEN** the client fetches `GET /review/sessions/:id`
- **THEN** the response includes `frameScreenshots` with up to N entries (one per frame whose screenshot capture succeeded)
- **AND** each `fileRef` points to a readable PNG file

#### Scenario: Session lookup before audit completes

- **WHEN** the client fetches a session whose audit is still `running`
- **THEN** the response includes `frameScreenshots: []` or omits the field

### Requirement: Writeback report on session record

The system SHALL store an outcome report for each writeback attempt as `writebackReport: { attemptedAt, written, skipped, failed: Array<{ nodeId, errorCode, errorMessage }> }`. Multiple attempts append; the most recent attempt's outcome drives the session's writeback status badge.

#### Scenario: Full success writeback

- **WHEN** an Approve & writeback operation completes with all node-writes succeeding and no nodes skipped
- **THEN** session `writebackReport` records `{ written: N, skipped: 0, failed: [] }`
- **AND** session's derived writeback status is `done_written_back`

#### Scenario: All-skipped writeback (no changes)

- **WHEN** every row's final user text equals the Figma original text
- **THEN** no MCP write calls are made
- **AND** session `writebackReport` records `{ written: 0, skipped: N, failed: [] }`
- **AND** session's derived writeback status is `done_no_changes`

#### Scenario: Partial commit

- **WHEN** an Approve & writeback operation writes K nodes successfully and M nodes fail
- **THEN** session `writebackReport` records `{ written: K, skipped: S, failed: [M entries] }`
- **AND** session's derived writeback status is `partial`
- **AND** subsequent "Retry failed" calls operate only on the failed-node subset

#### Scenario: All failed

- **WHEN** every node-write fails
- **THEN** `writebackReport.written` is 0
- **AND** session's derived writeback status is `failed`

### Requirement: Mode and scope on session record

The system SHALL persist the audit mode (`single_frame` or `workflow`) on Figma sessions so the Reviewlog list and detail view can render it without recomputing from `source.scope`.

#### Scenario: Single-frame mode

- **WHEN** session source scope is a single frame
- **THEN** session record carries `mode: "single_frame"`

#### Scenario: Workflow mode

- **WHEN** session source scope is a flow with multiple node IDs
- **THEN** session record carries `mode: "workflow"`
- **AND** the ordered `nodeIds` are persisted as the canonical step sequence

## API surface (delta)

No new endpoints beyond those declared in `figma-mcp-extraction` delta. Existing `POST /review/sessions`, `GET /review/sessions/:id`, `POST /review/audit/run`, `POST /review/changes/transition`, and `POST /figma/writeback` accept and emit the new fields.

## Dependencies (delta)

- `figma-mcp-extraction` (modified) — provides screenshots at audit completion
- `guidelines-runtime` — provides three-layer snapshot for the session's `guidelineSnapshot` field; product validation
