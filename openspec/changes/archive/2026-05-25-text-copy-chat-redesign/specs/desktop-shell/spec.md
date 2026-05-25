# desktop-shell Specification — Delta for `text-copy-chat-redesign`

> This delta adds a dedicated full-screen Text Copy chat route and reshapes Home navigation. Existing v1 review/sources/settings routes remain.

## Added Requirements

### Requirement: Dedicated Text Copy route

The desktop renderer SHALL expose a top-level route `/text-copy` that mounts a full-screen chat surface (no Settings sidebar, no review/sources tabs).

#### Scenario: Direct navigation

- **WHEN** the user navigates to `/text-copy`
- **THEN** the renderer mounts `TextCopyScreen`
- **AND** the Settings sidebar is not rendered
- **AND** the existing masthead remains with a back affordance and "Text Copy" title

### Requirement: Home routes Text Copy card to full-screen

The Home screen "Text Copy" card SHALL navigate to `/text-copy` (not `/settings?tab=review`).

#### Scenario: Click Text Copy card

- **WHEN** the user clicks "Go" on the "Text Copy" Home card
- **THEN** the renderer navigates to `/text-copy`

### Requirement: Proactive greeting + product picker

`TextCopyScreen` SHALL render a virtual assistant bubble on first load asking the user which product to audit, accompanied by a clickable list of products fetched from `GET /guidelines`. The bubble and list SHALL NOT be persisted to the daemon.

#### Scenario: At least one product exists

- **WHEN** `GET /guidelines` returns a tree with ≥1 products
- **THEN** the greeting bubble shows the question text
- **AND** the picker lists each product as a clickable option

#### Scenario: User picks a product

- **WHEN** the user clicks a product option
- **THEN** the renderer calls `POST /paste-text/conversations` with that `productId`
- **AND** the picker is replaced by a slim "Auditing {productName}" header above the message list
- **AND** the composer becomes enabled

### Requirement: Optional product selection on first load

`TextCopyScreen` SHALL let users start an audit without choosing a product. Product-specific guidelines are optional.

#### Scenario: Zero products on first load

- **WHEN** `GET /guidelines` returns zero products
- **THEN** the bubble explains that product-specific rules are optional
- **AND** a primary **Start audit** action enters the chat without `productId`
- **AND** a secondary CTA may navigate to `/settings?tab=guidelines` to add a product

#### Scenario: Products available but user skips product

- **WHEN** the picker lists one or more products
- **THEN** the user may pick a product OR choose **Continue without product-specific guidelines**
- **AND** skipping creates a conversation without `productId`, using company and software layers only

### Requirement: Thinking ribbon for pending assistant turns

While an assistant message is in `pending` state, `TextCopyScreen` SHALL render a ribbon indicating the active phase among `connecting`, `loading-guidelines`, `thinking`, `integrating`. The ribbon SHALL be derived solely from the polled `AgentRunEvent` stream and run status — no new daemon events.

#### Scenario: Phase progression

- **WHEN** a user message is sent and the assistant message status is `pending`
- **THEN** the ribbon first shows `connecting`
- **AND** transitions to `loading-guidelines` upon the first non-text event or 1.5s after conversation refresh
- **AND** transitions to `thinking` upon the first streaming text delta
- **AND** transitions to `integrating` upon final-text event or terminal run status
- **AND** disappears when the assistant message refreshes to non-pending status

#### Scenario: Skipped phase

- **WHEN** an event-stream phase boundary is missing (e.g. no tool events before first text)
- **THEN** the ribbon skips the absent phase and shows it as completed

#### Scenario: Failed run

- **WHEN** the agent run enters `failed` or `canceled`
- **THEN** the ribbon collapses to a single failed indicator
- **AND** the assistant message bubble shows the error per existing v1 behavior

### Requirement: Plus-menu composer

The composer SHALL render a plus (+) trigger button that opens a menu with two items:

- "Attach spreadsheet" (filters to `.csv`, `.xlsx`)
- "Attach text file" (filters to `.md`, `.txt`)

Each item invokes the existing attachment intake flow (`window.writerDesktop.pickPasteTextAttachment` → `POST /paste-text/attachments`).

#### Scenario: Click plus then spreadsheet

- **WHEN** the user clicks the plus trigger
- **AND** selects "Attach spreadsheet"
- **THEN** the macOS file picker opens filtered to `.csv`, `.xlsx`
- **AND** on selection, `POST /paste-text/attachments` is called with the chosen path

#### Scenario: Plus menu disabled states

- **WHEN** the daemon is disconnected OR workspace is not ready OR a rewrite is pending
- **THEN** the plus trigger is disabled

### Requirement: New conversation control

`TextCopyScreen` SHALL expose a "New conversation" control that clears local state and re-renders the greeting + picker.

#### Scenario: New conversation during active rewrite

- **WHEN** the user activates "New conversation" while an assistant message is `pending`
- **THEN** the renderer prompts for confirmation
- **AND** on confirm, in-flight polling is canceled and local state resets

## Modified Requirements

### Requirement: Settings-embedded chat panel is non-canonical

The existing in-Settings paste-text Card SHALL remain mounted for backward compatibility but SHALL be marked deprecated in source. Removal is scheduled for a follow-up change after analytics confirm no entry from `/settings?tab=review`.

#### Scenario: Settings tab still functional

- **WHEN** the user opens `/settings?tab=review` directly
- **THEN** the existing Card-based chat still renders and functions
- **AND** it now passes `productId` from `useWorkspace().selectedProductId` to satisfy the contracts change

## API surface

No new desktop-facing daemon endpoints. The renderer uses existing methods on `DaemonClient` plus the modified `POST /paste-text/conversations` body shape.

## Dependencies

- `paste-text-chat` (modified) — `productId` and `guidelineSnapshot` on conversations.
- `guidelines-runtime` — `GET /guidelines` for product list.
- `agent-adapter-runtime` — unchanged; existing event stream consumed for ribbon.
