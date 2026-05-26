## Why

Writer's Sources screen splits pasted text and spreadsheet import into separate forms, and audit runs on stub heuristics instead of the configured LLM adapter. Content designers need a single chat-style surface: provide UI background + copy (or upload a spreadsheet), receive rewrite suggestions they can copy immediately. This unifies light-edit and structured file workflows and connects the product to real agent runs.

## What Changes

- Add **Paste Text Chat** — conversation API with plain-text and structured-file modes
- Add **Copywriter Skill** — system prompt layer injecting writing rules + background; hard-limits LLM to rewrite output
- Add **attachment intake** — reuse spreadsheet parse; support CSV/XLSX via Electron file path
- Replace Sources three-tile layout with **one chat UI** (upload button in composer; no new nav section)
- Wire daemon orchestration to existing `POST /agents/runs` using active adapter

## Capabilities

### New Capabilities

- `paste-text-chat` — conversation, messages, rewrite orchestration, attachment metadata

### Modified Capabilities

- `desktop-shell` — Sources screen becomes chat surface; daemon client gains paste-text endpoints
- `review-session-storage` — optional link between paste-text conversation and review session (v1: conversation-only)

## Impact

- **packages/contracts** — new Zod schemas for conversations/messages/attachments
- **packages/review-core** — Copywriter Skill prompt builder + tests
- **packages/storage** — persist conversations/messages
- **apps/daemon** — new `/paste-text/*` routes; orchestrates agent runs
- **apps/desktop** — chat UI on Sources route (Issue 4); client methods (Issue 1 partial)

## Non-Goals (v1)

- Token streaming to UI
- Multipart HTTP upload (use Electron path picker)
- Figma URL intake inside chat (stays separate until unified v2)
- Findings/approval queue integration per chat turn
- Codex/Claude adapter registration (cursor-agent + devin only)
