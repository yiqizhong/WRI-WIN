# desktop-shell Specification — Delta for `figma-audit-redesign`

> This delta adds three full-screen routes for the redesigned Figma audit surface, plus supporting components (rule modal, frame screenshot rendering, writeback button). The existing `/review` route remains mounted as deprecated back-compat.

## Added Requirements

### Requirement: Figma Audit entry route

The desktop renderer SHALL expose a top-level route `/figma-audit` that mounts a full-screen entry form (no Settings sidebar, no review/sources tabs) with fields for product (optional), feature name (required), description (required), and mode (Single Frame / Workflow).

#### Scenario: Direct navigation to /figma-audit

- **WHEN** the user navigates to `/figma-audit`
- **THEN** the renderer mounts `FigmaAuditScreen`
- **AND** the Settings sidebar is not rendered
- **AND** the masthead remains with a back affordance and "Figma Audit" title

#### Scenario: Submit Single Frame mode

- **WHEN** the user fills feature name, description, optionally selects a product, picks Single mode, pastes one Figma frame URL, and submits
- **THEN** the renderer calls `POST /review/sessions` with `{ source: { kind: "figma", scope: "frame", url }, featureName, description, productId? }`
- **AND** triggers `POST /review/audit/run` for the returned session
- **AND** navigates to `/audits`

#### Scenario: Submit Workflow mode via Paste-links

- **WHEN** the user fills required metadata, picks Workflow → Paste-links tab, enters multiple step URLs in order, and submits
- **THEN** the renderer calls `POST /review/sessions` with `{ source: { kind: "figma", scope: "flow", nodeIds: [...] }, featureName, description, productId?, mode: "workflow" }`
- **AND** triggers the audit run and navigates to `/audits`

#### Scenario: Submit Workflow mode via Browse-page

- **WHEN** the user fills required metadata, picks Workflow → Browse-page tab, pastes a Figma page URL, clicks "Load frames"
- **THEN** the renderer calls `POST /figma/list-page-frames` and renders the ordered frame list with the detected direction banner
- **AND** allows the user to drag-reorder rows and uncheck frames
- **AND** on submit, calls `POST /review/sessions` with the user-confirmed ordered subset of `nodeIds`
- **AND** triggers the audit run and navigates to `/audits`

### Requirement: Home routes Figma Copy card to /figma-audit

The Home screen "Figma Copy" card SHALL navigate to `/figma-audit` (not `/settings?tab=sources`).

#### Scenario: Click Figma Copy card

- **WHEN** the user clicks "Go" on the "Figma Copy" Home card
- **THEN** the renderer navigates to `/figma-audit`

### Requirement: Audits list route

The desktop renderer SHALL expose a top-level route `/audits` that lists all Figma audit sessions for the current project as a table with status badges.

#### Scenario: Render list

- **WHEN** the user navigates to `/audits`
- **THEN** the renderer fetches sessions for the active project
- **AND** renders a table with columns: feature name, product, mode, status, created time, Open
- **AND** newest sessions appear first

#### Scenario: Status badge mapping

- **WHEN** rendering a row
- **THEN** the status badge reflects the session lifecycle:
  - audit running → `In Progress`
  - audit completed, no writeback attempt → `Done · ready to review`
  - writeback all written → `Done · written back`
  - writeback all skipped (no changes) → `Done · no changes`
  - writeback partial → `Partial · N written, M failed`
  - writeback all failed OR audit failed → `Failed`

#### Scenario: Open opens detail

- **WHEN** the user clicks "Open" on a row
- **THEN** the renderer navigates to `/audits/:sessionId`

### Requirement: Audit detail route

The desktop renderer SHALL expose `/audits/:sessionId` to display per-frame audit results with screenshot, structured findings table, rule modal, and Approve & writeback action.

#### Scenario: Render header

- **WHEN** the detail page mounts for a session
- **THEN** it renders a header with feature name, product name (or "—"), original description, and a pill showing the active guideline layers ("Auditing against: Company Base + Software Writing" or "...+ Product: {name}")

#### Scenario: Render per-frame section

- **WHEN** the session contains N frames in scope
- **THEN** the detail page renders N sections in the session's `mode`-defined order (single frame → 1 section; workflow → in the persisted `nodeIds` order)
- **AND** each section shows the frame screenshot inline (or "Screenshot unavailable" placeholder if missing)
- **AND** each section renders a table with columns: # | element type | original copy | AI suggested copy | rule link | user edit field

#### Scenario: User edit field pre-population

- **WHEN** a row is first rendered
- **THEN** the user edit field is pre-populated with the AI suggested copy
- **AND** the field is editable

### Requirement: Rule modal

A "rule link" on each row SHALL open a modal showing the matched rule content sourced from the session's `guidelineSnapshot`, along with a badge indicating its source layer.

#### Scenario: Open rule modal

- **WHEN** the user clicks the rule link on a row
- **THEN** a modal opens showing the rule's text content
- **AND** a badge: "Company Base" / "Software Writing" / "Product: {name}" identifies the source layer
- **AND** the modal can be dismissed by Escape or backdrop click

#### Scenario: Rule missing from snapshot

- **WHEN** a row's `ruleId` is not present in the snapshot (e.g. stale data)
- **THEN** the modal shows "Rule not found in this session's snapshot" with the `ruleId` for diagnostics

### Requirement: Approve & writeback action

The detail page SHALL provide a single primary action "Approve & writeback to Figma" that approves all rows (using each row's user edit field as the final text), then writes back to Figma with partial-commit semantics.

#### Scenario: Click Approve & writeback — full success

- **WHEN** the user clicks Approve & writeback
- **AND** every row's final text differs from its original Figma text
- **AND** every node-write succeeds
- **THEN** all rows transition to `approved` with their edited text
- **AND** `POST /figma/writeback` is called and reports `{ written: N, skipped: 0, failed: [] }`
- **AND** the renderer shows a success toast and navigates back to `/audits`
- **AND** the list row now shows `Done · written back`

#### Scenario: Auto-skip rows where final text equals original

- **WHEN** some rows' final text equals the Figma original text
- **THEN** those rows are not sent to Figma writeback
- **AND** the writeback report's `skipped` count reflects them
- **AND** the detail page surfaces "N rows skipped (no changes)" inline

#### Scenario: Partial failure with retry

- **WHEN** writeback returns with some `failed` entries
- **THEN** the detail page stays mounted (no auto-navigate)
- **AND** the writeback report is surfaced inline as "N written, M failed"
- **AND** a "Retry failed" button appears that re-invokes writeback with only the failed `changeIds`
- **AND** the `/audits` list row reflects `Partial · N written, M failed`

#### Scenario: Disabled when no findings

- **WHEN** the session has zero findings
- **THEN** the Approve & writeback button is disabled with explanation

## Modified Requirements

### Requirement: /review route is deprecated but mounted

The existing `/review` route SHALL remain mounted and functional for back-compat. Source code SHALL include a deprecation comment pointing to the new audit screens. Removal is scheduled for a follow-up change after analytics confirm no entry.

#### Scenario: /review still works

- **WHEN** the user opens `/review` directly
- **THEN** the existing screen renders and functions
- **AND** export, "Run audit again", and review queue panels continue to operate

## API surface

No new desktop-facing daemon endpoints beyond those declared in `figma-mcp-extraction` and `review-session-storage` deltas. The renderer adds typed client methods for `POST /figma/list-page-frames` and consumes the extended session shape via existing `GET /review/sessions/:id`.

## Dependencies

- `figma-mcp-extraction` (modified) — `POST /figma/list-page-frames`, screenshot capture
- `review-session-storage` (modified) — `featureName`, `description`, `productId?`, `frameScreenshots`, `writebackReport`, `mode`
- `guidelines-runtime` — for rule modal source-layer lookup
- Existing `agent-adapter-runtime` — unchanged
