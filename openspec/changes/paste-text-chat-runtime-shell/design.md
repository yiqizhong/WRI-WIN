# Design · Paste Text Chat Runtime Shell

## Context

Writer Chat is an Electron + Vite renderer talking to the local daemon paste-text API. Backend async send and `agentRunId` polling already exist (`paste-text-send-latency`, `paste-text-chat` spec). The remaining pain is **desktop orchestration and layout**, not LLM latency.

Constraints:

- Renderer must not call external chat SaaS or import assistant-ui.
- Daemon contracts unchanged in v1.
- Match existing masthead + Writer visual language.

## Goals / Non-Goals

**Goals:**

- Gemini-style **welcome** (centered greeting + composer) and **active** (thread scroll + bottom composer).
- **Optimistic first turn** so layout and user bubble appear on send start.
- **Single run sync loop** with abort semantics for new conversation / unmount / product change.
- **Stable viewport** so active composer anchors to window bottom.
- Unit tests for phase derivation, optimistic merge, and scroll policy.

**Non-Goals:**

- assistant-ui, Vercel AI SDK, Assistant Cloud, or their skills/MCP.
- New daemon routes or streaming transport.
- Reintroducing mandatory first-load product picker bubble (product remains header dropdown).

## Architecture

```
TextCopyScreen
└─ TextCopyChat (thin container)
   ├─ usePasteTextChatRuntime(props)
   │    ├─ phase: welcome | active
   │    ├─ displayMessages (server + optimistic, deduped by id)
   │    ├─ sendMessage / attach / newConversation guards
   │    ├─ runSync: poll GET /agents/runs/:id while pending
   │    └─ scrollIntent: enum for ChatShellView
   └─ ChatShellView({ phase, header, thread, composer, error })
        ├─ welcome: flex-1 center column (greeting + composer)
        └─ active: flex-1 overflow thread + shrink-0 bottom composer
```

## Decisions

### D1: Explicit phase state machine

- **Choice:** `deriveChatPhase({ hasSubmittedTurn, forceWelcome })` → `welcome` | `active`.
- **Rules:**
  - `welcome` when no submitted user turn in local+server state, or after confirmed new conversation.
  - `active` when user initiates send (optimistic user row appended) — **before** HTTP completes.
- **Rejected:** Phase = `messages.length > 0` only — ties layout to network latency.

### D2: Optimistic turn envelope

- **Choice:** On send start, append `{ optimisticId, userText, pendingAssistantPlaceholder }` to a local overlay merged with `conversation.messages` for render.
- **Reconcile:** Replace overlay when `sendPasteTextMessage` returns; on error, remove optimistic assistant and mark user row failed or show InlineAlert without losing draft.
- **Rejected:** Wait for API before any UI change — causes centered composer + delayed thread.

### D3: Extract `usePasteTextRunSync`

- **Choice:** Hook accepts `{ conversationId, pendingMessageId, agentRunId, client, onTerminal }`; owns interval (500ms per existing design doc, or 100ms if kept — document single constant); sets `streamingText`, `runEvents`, `runStatus`; clears on terminal.
- **Abort:** `AbortController` or `cancelled` flag on dependency change; clear interval in cleanup.
- **Rejected:** Duplicate poll logic in panel + chat files (panel is deprecated path).

### D4: Scroll policy

- **Choice:**
  - Scroll to bottom on: new user message, assistant terminal, phase → active.
  - During streaming: scroll only if user within ~80px of bottom OR throttle to 300ms max once per 300ms.
  - Use `behavior: 'auto'` for stream ticks; `smooth` only on user send.
- **Rejected:** `smooth` on every `streamingText` change.

### D5: Viewport flex contract (regression guard)

- **Choice:** Document and test chain:
  - `writer-app-viewport__content` → `display: flex; flex-direction: column`
  - `ProductChrome` inner wrapper `flex-1 min-h-0`
  - `TextCopyScreen` root `flex-1 min-h-0 flex-col`
  - `TextCopyChat` root `flex-1 min-h-0 flex-col overflow-hidden`
  - Active: thread `flex-1 min-h-0 overflow-y-auto`; composer `shrink-0 mt-auto`
- **Rejected:** Rely on content height without flex-1 parents (root cause of mid-screen composer).

### D6: Composer interaction while pending

- **Choice:** `pendingRewrite` disables **Send** and attachment; textarea remains editable (user can draft next message) OR fully disabled — **pick editable draft** for v1 to match common chat UX.
- **Rejected:** `sending` flag blocking entire composer during fast async response — redundant with optimistic path; narrow `sending` to double-submit guard only.

### D7: Independence guardrail

- **Choice:** No new dependencies; implementation only in `apps/desktop`.
- **CI grep optional (future):** block `@assistant-ui/*` imports in desktop package.

## Affected paths

| Path | Change |
|------|--------|
| `apps/desktop/src/text-copy-chat.tsx` | Thin view; delegate to hook + shell |
| `apps/desktop/src/paste-text-chat-runtime/` (new) | phase, hook, run sync, scroll util |
| `apps/desktop/src/styles/writer-app-frame.css` | Confirm flex rules |
| `apps/desktop/src/screens/text-copy-screen.tsx` | `flex-1` root |
| `openspec/specs/desktop-shell/spec.md` | Sync on archive |
| `openspec/specs/paste-text-chat-runtime/spec.md` | New (via delta) |

## Risks / mitigations

| Risk | Mitigation |
|------|------------|
| Optimistic/server duplicate messages | Dedupe by server id on reconcile; strip optimistic ids |
| Poll races after new chat | Abort hook; ignore stale `conversationId` |
| Spec vs product picker drift | Delta explicitly supersedes virtual picker requirement |

## Verification

- `npm run typecheck`
- `npm run test --workspace @writer/desktop`
- Manual: welcome center → send → bottom dock → stream → new conversation → welcome
