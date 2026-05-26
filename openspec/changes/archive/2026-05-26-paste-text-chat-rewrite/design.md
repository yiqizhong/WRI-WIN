# Design · Paste Text Chat Rewrite

## Context

Writer is a local-first Electron app: renderer → daemon → agent adapters (Cursor, Devin). Paste text today creates a review session via `POST /sessions/pasted-text`; spreadsheet uses `POST /spreadsheet/parse`. LLM runs exist at `POST /agents/runs` but are disconnected from Sources UX. Audit uses `runStubAudit()` heuristics.

Stakeholders: content designers / PMs rewriting UX copy against brand voice and UI context.

Constraints:
- Renderer never invokes CLIs directly
- All I/O validated via `@writer/contracts`
- Active LLM adapter from platform store

## Goals

1. Single chat surface merging plain text + spreadsheet attachment flows
2. Pre-inject background + writing rules before user sends copy
3. Return copy-ready rewritten text per message
4. Reuse agent adapter runtime (no duplicate LLM client)

## Non-Goals

- Streaming UI (v2)
- Auto-populate Review queue from chat turns (v2)
- General-purpose chatbot (skill constrains output)
- New nav section (integrate into existing Sources route)

## Decisions

### D1: Conversation-first API (not session-first)

**Choice:** New `PasteTextConversation` entity with messages, separate from but linkable to `ReviewSession`.

**Rationale:** Chat UX needs turn history and lightweight lifecycle; review sessions carry audit/approval semantics.

**Alternative rejected:** Overload `ReviewSession.scope` with messages — couples chat to queue model.

### D2: Orchestration in daemon `paste-text.ts`

**Choice:** `POST /paste-text/conversations`, `POST /paste-text/conversations/:id/messages`, `POST /paste-text/attachments`.

Message handler: assemble Copywriter Skill prompt → `startAgentRun` → parse assistant text → append message.

### D3: Copywriter Skill in `@writer/review-core`

**Choice:** `buildCopywriterPrompt({ systemRole, backgroundContext, brandVoice, history, userText, mode })`.

Hard constraints in system block:
- Role: Senior Software Copywriter
- Output: rewritten text only (+ optional one-line rationale)
- Refuse off-topic requests

### D4: Attachment via local file path

**Choice:** `{ filePath }` + reuse `@writer/spreadsheet` parse for CSV/XLSX.

Plain `.txt` / `.md` read as UTF-8 for `plain_text` bulk context.

### D5: Two input modes in one conversation

| Mode | Trigger | Processing |
|------|---------|------------|
| `plain_text` | User sends text in composer | Direct rewrite |
| `structured_file` | User uploads spreadsheet | Parse rows; user message selects row index or "all visible" batch |

## Data flow

```text
Desktop composer
  → POST /paste-text/conversations { projectId, backgroundContext }
  → POST /paste-text/attachments { conversationId, filePath }  (optional)
  → POST /paste-text/conversations/:id/messages { text, rowIndex? }
Daemon paste-text service
  → buildCopywriterPrompt(...)
  → startAgentRun({ sessionId, prompt })  // sessionId = linked review session or ephemeral
  → extractAssistantText(events)
  → persist assistant message
  → return { message, suggestedText }
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| LLM returns prose outside rewrite format | Skill + response parser; strip preamble; test fixtures |
| Agent run latency (45s+) | UI loading state (Issue 4); timeout messaging |
| Spreadsheet row selection UX complexity | v1: optional `rowIndex`; default first row |
| Conversation storage growth | Cap history turns in prompt (last 6) |

## Migration Plan

1. Ship backend + skill + attachments (Issues 1–3) with integration tests
2. Ship chat UI replacing Sources tiles (Issue 4)
3. Deprecate standalone "Start pasted text session" button (keep API for compat)

Rollback: feature-flag chat UI; revert to tile layout.

## Open Questions

- Link every conversation to a `ReviewSession` at creation, or lazily on first message? **Decision: create lightweight session on first message** for agent run compatibility.
