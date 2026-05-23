# paste-text-chat Specification

## Purpose

Provide a chat-style API for rewriting UX copy using the active LLM adapter, supporting plain text and structured spreadsheet attachments.

## Requirements

### Requirement: Create conversation

The system SHALL allow creating a paste-text conversation with `projectId` and optional `backgroundContext` (UI context / writing rules).

#### Scenario: Create with background

- **WHEN** client sends `POST /paste-text/conversations` with `{ projectId, backgroundContext }`
- **THEN** daemon returns `{ conversation }` with `id`, `projectId`, `backgroundContext`, `inputMode: "plain_text"`, empty messages

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

The system SHALL include conversation background and recent message history when assembling the LLM prompt.

#### Scenario: Multi-turn context

- **WHEN** user sends a second message in the same conversation
- **THEN** prompt includes `backgroundContext`, project brand voice (if set), and prior turns (capped)

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

## API surface

| Method | Path | Description |
|--------|------|-------------|
| POST | `/paste-text/conversations` | Create conversation |
| GET | `/paste-text/conversations/:id` | Get conversation + messages |
| POST | `/paste-text/conversations/:id/messages` | Send user message → rewrite |
| POST | `/paste-text/attachments` | Attach file by path |

## Dependencies

- `agent-adapter-runtime` — `POST /agents/runs`
- `@writer/review-core` — Copywriter Skill prompt builder
- `@writer/spreadsheet` — CSV/XLSX parse
- `review-session-storage` — linked session for agent runs
