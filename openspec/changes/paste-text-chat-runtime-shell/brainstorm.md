# Brainstorm · Paste Text Chat Runtime Shell

## User outcome

Content designers open **Chat** (`/text-copy`) and get a Gemini-style flow:

1. **Welcome** — short greeting + composer centered in the viewport (no message thread yet).
2. **First send** — layout switches immediately to **active**: user message visible, composer **sticks to the bottom**, assistant pending/streaming above.
3. **Ongoing** — scroll stays natural during rewrite; no layout jump, no composer floating mid-screen.

## Reference patterns (conceptual only — zero external product dependency)

| Pattern | What we borrow | What we do **not** import |
|---------|----------------|---------------------------|
| Gemini / Claude empty state | Centered composer + one-line greeting | Their UI kit, cloud, or APIs |
| Chat runtime / UI split | Orchestration (send, poll, merge state) separate from layout (welcome vs active) | assistant-ui packages, registry, skills, MCP |
| Optimistic turn | User sees their message before network round-trip completes | Third-party sync backends |
| Viewport flex contract | `flex-1 min-h-0` chain so bottom composer is truly at window bottom | Framework-specific scaffolds |

## Current gaps (desktop)

- **Phase** is inferred only from `messages.length`; switch happens after `sendPasteTextMessage` returns → late layout transition.
- **Send UX** uses `sending` to disable composer; user waits without optimistic bubbles.
- **Polling** lives inside `TextCopyChat` with 100ms interval; cancellation works but logic is not isolated or unit-tested.
- **Scroll** runs `smooth` scroll on every streaming delta → janky.
- **Layout** viewport flex was fixed in `feat/chat-ui-polish`, but phase/composer binding can still regress without spec.
- **Spec drift** — `desktop-shell` still describes virtual product-picker greeting; implementation simplified.

## Daemon boundary (unchanged this change)

- Async `POST .../messages` returns user + pending assistant immediately (`paste-text-send-latency`).
- Desktop polls `GET /agents/runs/:id` and refreshes conversation on terminal status.
- No new daemon events, SSE, or external services.

## Forks / decisions (converged)

| Topic | Decision |
|-------|----------|
| External chat UI libs | **Reject** — Writer-only hooks and components |
| Optimistic UI | **Yes** — local turn on send start; reconcile on API response |
| Phase trigger | **active** on send action, not on HTTP completion |
| Composer while pending | Disable **send** only; keep draft focus stable (document in design) |
| Animation | Optional 150–200ms layout transition v1.1; not blocking v1 |
| SSE | Deferred v2 |

## Acceptance (designer-visible)

- [ ] Fresh `/text-copy`: composer vertically centered; greeting above it.
- [ ] After first send (&lt;100ms perceived): composer at bottom; user bubble visible without waiting for rewrite to finish.
- [ ] During pending/streaming: composer stays bottom; ribbon then text in one assistant slot.
- [ ] New conversation: returns to welcome phase; in-flight poll canceled.
- [ ] Resize window: composer remains bottom in active phase.

## Convergence

Scope is **desktop renderer runtime + shell layout only**. Ready for `proposal` → `design` → `specs` → `tasks` → `/opsx-apply` after explicit apply ack.
