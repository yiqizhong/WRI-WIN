# Brainstorm · Paste Text Chat Runtime Shell

## User outcome

Content designers open **Chat** (`/text-copy`) and get a Gemini-style flow:

1. **Welcome** — short greeting + composer centered in the viewport (no message thread yet).
2. **First send** — layout switches immediately to **active**: the same composer travels smoothly from center to the bottom dock while the optimistic user message rises into the thread.
3. **Ongoing** — scroll stays natural during rewrite; no layout jump, no composer floating mid-screen.
4. **Drafting** — the composer grows and shrinks smoothly from 1 to 5 visible lines while typing, then scrolls internally for longer text.

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
| First-send motion | **Continuous migration** — persistent composer + FLIP from welcome center to active bottom dock; user bubble rises after a short offset |
| Composer resize motion | **Responsive settle** — animated 1–5 line growth/shrink at ~150ms, no bounce; overflow scrolls internally after line 5 |
| Reduced motion | Keep all final states and feedback; suppress travel/resize transitions under `prefers-reduced-motion: reduce` |
| SSE | Deferred v2 |

## Motion study decisions (2026-05-25)

- Visual comparison selected **A / continuous migration** for first send: the composer must read as one object moving to its active position, rather than a replacement appearing at the bottom.
- Visual comparison selected **B / responsive settle** for multiline input: height changes respond immediately and settle quickly, rather than using strict mechanical linear motion or a slower decorative easing.
- Scope remains the desktop renderer shell only. There are no daemon, contract, adapter, external library, or new visual-system changes.

## Acceptance (designer-visible)

- [ ] Fresh `/text-copy`: composer vertically centered; greeting above it.
- [ ] After first send: the focused composer continuously travels from center to bottom in about 240ms; an optimistic user bubble enters without waiting for rewrite completion.
- [ ] Composer text grows and shrinks smoothly between 1 and 5 visible lines; content beyond 5 lines scrolls inside the input.
- [ ] During pending/streaming: composer stays bottom; ribbon then text in one assistant slot.
- [ ] New conversation: returns to welcome phase with the same reverse composer migration when motion is enabled; in-flight poll canceled.
- [ ] Resize window: composer remains bottom in active phase.
- [ ] Reduced-motion preference: transitions are suppressed without changing correct layout, focus, or send behavior.

## Convergence

Scope is **desktop renderer runtime + shell layout only**. Ready for `proposal` → `design` → `specs` → `tasks` → `/opsx-apply` after explicit apply ack.
