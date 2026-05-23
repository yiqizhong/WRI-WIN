# Tasks · Paste Text Chat Rewrite

Maps to Linear epic **WRI-84** (parent) and child issues WRI-85–WRI-88.

## 1. Backend API & model integration (WRI-85)

- [x] 1.1 Add contracts: `PasteTextConversation`, `PasteTextMessage`, `PasteTextAttachment`, links in `packages/contracts/src/paste-text.ts`
- [x] 1.2 Add storage: persist conversations/messages in `PlatformStore`
- [x] 1.3 Implement `apps/daemon/src/paste-text.ts` — create conversation, send message, orchestrate agent run
- [x] 1.4 Add routes: `POST /paste-text/conversations`, `GET /paste-text/conversations/:id`, `POST /paste-text/conversations/:id/messages`
- [x] 1.5 Daemon tests: `apps/daemon/src/paste-text.test.ts`
- [x] 1.6 Desktop `daemon-client.ts`: typed client methods (no UI yet)

## 2. Copywriter Skill / system prompt (WRI-86)

- [x] 2.1 Add `packages/review-core/src/copywriter-skill.ts` — system prompt + user prompt assembly
- [x] 2.2 Hard constraints: rewrite-only output, background injection, brand voice merge
- [x] 2.3 Response parser: extract `suggestedText` from agent event text
- [x] 2.4 Unit tests with fixture inputs (plain text, with background, off-topic refusal pattern)

## 3. Attachment processing (WRI-87)

- [x] 3.1 Contract: `POST /paste-text/attachments` input `{ conversationId, filePath }`
- [x] 3.2 CSV/XLSX: delegate to existing spreadsheet parse; store parse result on attachment
- [x] 3.3 Plain text files (.txt, .md): read UTF-8 into attachment context
- [x] 3.4 Message handler: when `structured_file` + `rowIndex`, inject row cells into prompt
- [x] 3.5 Tests: parse attachment + rewrite message for row 0

## 4. Chat UI (WRI-88)

- [x] 4.1 `PasteTextChatPanel` — message list, composer, send
- [x] 4.2 Background context field (collapsible) before first message
- [x] 4.3 Upload button in composer → Electron picker → `POST /paste-text/attachments`
- [x] 4.4 Replace Sources screen paste/spreadsheet tiles with chat panel (Figma tile kept)
- [x] 4.5 Copy-to-clipboard on assistant messages
- [x] 4.6 Loading / error states per message (inline notification, no toast)

## Verification

- `npm run typecheck && npm run test`
- Manual: open Sources → set background → paste copy → receive rewrite → copy result
- Upload CSV → send message with row → receive row rewrite
