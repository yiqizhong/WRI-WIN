# paste-text-chat Specification — Delta for `text-copy-chat-redesign`

> This delta extends the v1 `paste-text-chat` capability with required product binding, three-layer guideline snapshot, and prompt injection. Existing v1 requirements remain unless explicitly modified.

## Modified Requirements

### Requirement: Create conversation

The system SHALL require `projectId` AND `productId` when creating a paste-text conversation. The system SHALL resolve and snapshot the Company Base, Software Writing, and Product-specific guideline layers at creation time.

#### Scenario: Create with valid product

- **WHEN** client sends `POST /paste-text/conversations` with `{ projectId, productId }` and `productId` matches a product in the Guidelines tree
- **THEN** daemon resolves the inherited guideline view for that product
- **AND** persists `guidelineSnapshot` on the conversation with up to three layers (each carrying `id`, `contentHash`, `content`)
- **AND** returns `{ conversation }` with `productId`, `guidelineSnapshot`, `inputMode: "plain_text"`, empty messages

#### Scenario: Create with unknown product

- **WHEN** client sends `POST /paste-text/conversations` with a `productId` not present in the Guidelines tree
- **THEN** daemon returns a 400-class error referencing `productId`

#### Scenario: Create without product

- **WHEN** client sends `POST /paste-text/conversations` without `productId`
- **THEN** daemon returns a 400-class error; conversation is not created

### Requirement: Conversation history in prompt

The system SHALL include the snapshotted three-layer guideline blocks plus recent message history when assembling the LLM prompt. Layers SHALL be emitted in priority order: Company Base, Software Writing, Product-specific. The system prompt SHALL instruct the model to prefer Product over Software Writing over Company Base on rule conflict.

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

## Added Requirements

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

### Requirement: Empty-products fast fail

The system SHALL reject conversation creation requests targeting a `productId` when the Guidelines tree has zero products discovered.

#### Scenario: Zero products

- **WHEN** `GET /guidelines` returns a tree with no products
- **AND** a client attempts `POST /paste-text/conversations` with any `productId`
- **THEN** daemon returns an error indicating no products are available

## API surface (delta)

| Method | Path | Change |
|--------|------|--------|
| POST | `/paste-text/conversations` | Request body adds required `productId: string`; response `conversation` carries new `productId` and optional `guidelineSnapshot` |
| GET | `/paste-text/conversations/:id` | Response `conversation` carries `productId` and `guidelineSnapshot` |

Existing endpoints (`/paste-text/conversations/:id/messages`, `/paste-text/attachments`) are unchanged on the wire; their internal prompt assembly now consumes the snapshot.

## Dependencies (delta)

- `guidelines-runtime` — consume `getGuidelinesTree`, `buildInheritedView` (or equivalent in `apps/daemon/src/guidelines/inheritance.ts`), content hashing from `snapshot.ts`.
- `@writer/contracts` — `PasteTextConversation` schema extended.
- `@writer/review-core` — `CopywriterSkillInput` extended with three layer blobs; system prompt updated.
