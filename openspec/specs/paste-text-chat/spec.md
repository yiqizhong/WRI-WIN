# paste-text-chat Specification

## Purpose

Provide a chat-style API for rewriting UX copy using the active LLM adapter, with optional three-layer guideline grounding (Company Base, Software Writing, Product-specific), plain text and structured spreadsheet attachments.

## Requirements

### Requirement: Create conversation

The system SHALL require `projectId` when creating a paste-text conversation. `productId` is optional. The system SHALL resolve and snapshot available guideline layers at creation time: Company Base and Software Writing when present; Product-specific layer only when `productId` is provided and resolvable. Optional `backgroundContext` (UI context / writing rules) remains supported.

#### Scenario: Create with background

- **WHEN** client sends `POST /paste-text/conversations` with `{ projectId, backgroundContext }`
- **THEN** daemon returns `{ conversation }` with `id`, `projectId`, optional `backgroundContext`, `inputMode: "plain_text"`, empty messages

#### Scenario: Create with valid product

- **WHEN** client sends `POST /paste-text/conversations` with `{ projectId, productId }` and `productId` matches a product in the Guidelines tree
- **THEN** daemon resolves the inherited guideline view for that product
- **AND** persists `guidelineSnapshot` on the conversation with up to three layers (each carrying `id`, `contentHash`, `content`)
- **AND** returns `{ conversation }` with `productId`, `guidelineSnapshot`, `inputMode: "plain_text"`, empty messages

#### Scenario: Create with unknown product

- **WHEN** client sends `POST /paste-text/conversations` with a `productId` not present in the Guidelines tree
- **THEN** daemon returns a 400-class error referencing `productId`

#### Scenario: Create without product

- **WHEN** client sends `POST /paste-text/conversations` with `{ projectId }` only (no `productId`)
- **THEN** daemon snapshots Company Base and Software Writing layers when present
- **AND** omits the Product-specific layer
- **AND** returns `{ conversation }` without `productId`, with `inputMode: "plain_text"`, empty messages

### Requirement: Send message and receive rewrite

The system SHALL accept user text and return an assistant message containing suggested rewritten copy.

#### Scenario: Plain text rewrite

- **WHEN** client sends `POST /paste-text/conversations/:id/messages` with `{ text }`
- **THEN** daemon runs active LLM adapter via agent run orchestration
- **AND** returns `{ userMessage, assistantMessage }` where `assistantMessage.suggestedText` is non-empty

#### Scenario: Missing active adapter

- **WHEN** no active adapter is configured or adapter is unavailable
- **THEN** daemon returns an error with diagnostic message (no silent fallback)

### Requirement: Conversation history in prompt

The system SHALL include snapshotted guideline blocks, conversation background, and recent message history when assembling the LLM prompt. Guideline layers SHALL be emitted in priority order: Company Base, Software Writing, Product-specific. The system prompt SHALL instruct the model to prefer Product over Software Writing over Company Base on rule conflict.

#### Scenario: Multi-turn context

- **WHEN** user sends a second message in the same conversation
- **THEN** prompt includes guideline snapshot layers (when present), `backgroundContext`, project brand voice (if set), and prior turns (capped)

#### Scenario: Multi-turn context with three layers

- **WHEN** user sends a second message in a conversation whose snapshot contains all three layers
- **THEN** the assembled prompt contains three `Writing rules (…)` sections in priority order
- **AND** the system prompt contains the conflict-resolution instruction
- **AND** prior user/assistant turns appear after the rules sections (capped by existing history limit)

#### Scenario: Missing layer

- **WHEN** the snapshot contains only Company Base + Product (no Software Writing layer was discovered)
- **THEN** the assembled prompt emits only the two present sections
- **AND** the conflict-resolution instruction still appears
- **AND** no placeholder text is emitted for the missing layer

### Requirement: Attachment intake

The system SHALL accept spreadsheet or plain-text file attachments via local file path.

#### Scenario: Spreadsheet attachment

- **WHEN** client sends `POST /paste-text/attachments` with `{ conversationId, filePath }` for `.csv` or `.xlsx`
- **THEN** daemon parses file using spreadsheet module
- **AND** sets conversation `inputMode` to `structured_file`
- **AND** stores parse metadata on attachment record

#### Scenario: Plain text file attachment

- **WHEN** file extension is `.txt` or `.md`
- **THEN** daemon reads UTF-8 content into attachment context for subsequent messages

### Requirement: Structured row rewrite

The system SHALL support optional `rowIndex` on messages when conversation has structured file attachment.

#### Scenario: Rewrite spreadsheet row

- **WHEN** message includes `{ text, rowIndex: 0 }` and attachment has parsed rows
- **THEN** prompt includes row cell values for that index
- **AND** assistant returns rewrite for that row's copy

### Requirement: Copywriter output constraint

The system SHALL constrain LLM output to copy rewrite via Copywriter Skill system prompt (no general chat).

#### Scenario: Off-topic user input

- **WHEN** user asks unrelated question (e.g. "what is the weather")
- **THEN** assistant response declines and redirects to copy rewrite scope

### Requirement: Product binding immutability

The system SHALL NOT allow changing `productId` on an existing conversation. Switching product requires creating a new conversation.

#### Scenario: Attempt to change product

- **WHEN** a client mutation targets `productId` on an existing conversation (any endpoint)
- **THEN** daemon rejects the request without modifying state

### Requirement: Snapshot freshness boundary

The system SHALL use the snapshot captured at conversation creation for all subsequent messages in that conversation. Live edits to underlying `.md` guideline files SHALL NOT affect an active conversation.

#### Scenario: Live edit during active conversation

- **GIVEN** a conversation with a snapshot containing a specific Product guideline
- **WHEN** the user edits the product `.md` file on disk between two messages
- **THEN** the second message's prompt uses the snapshot content, not the edited file

### Requirement: Zero products does not block audit

The system SHALL allow conversation creation when the Guidelines tree has zero products, as long as `productId` is omitted. Product-specific grounding remains optional.

#### Scenario: Zero products, no productId

- **WHEN** `GET /guidelines` returns a tree with no products
- **AND** a client sends `POST /paste-text/conversations` with `{ projectId }` only
- **THEN** daemon creates the conversation using Company Base and Software Writing snapshots when available
- **AND** does not require adding a product first

## API surface

| Method | Path | Description |
|--------|------|-------------|
| POST | `/paste-text/conversations` | Create conversation (`projectId`, optional `productId`, optional `backgroundContext`) |
| GET | `/paste-text/conversations/:id` | Get conversation (includes optional `productId`, `guidelineSnapshot`) |
| POST | `/paste-text/conversations/:id/messages` | Send message, receive rewrite |
| POST | `/paste-text/attachments` | Attach spreadsheet or plain-text file |
