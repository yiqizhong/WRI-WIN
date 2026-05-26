# Verify · paste-text-chat-runtime-shell

> Fill in during `/opsx-apply` and before archive.

## Automated

| Command | Result |
|---------|--------|
| `npm run typecheck` | Baseline pass before motion polish increment; rerun after Tasks 5.1–5.4 |
| `npm run test --workspace @writer/desktop` | Baseline pass before motion polish increment — 13 files, 42 tests; rerun after implementation |
| `openspec validate paste-text-chat-runtime-shell --type change --strict` | Baseline pass; rerun after amended artifacts and implementation |

## Manual (Chat `/text-copy`)

- [ ] Fresh load: greeting + composer visually centered; no thread list
- [ ] First send: composer visibly travels from center to bottom as one retained input; user bubble enters without waiting for the daemon
- [ ] Multiline draft: composer grows/shrinks smoothly between 1 and 5 visible lines and internally scrolls beyond 5 lines
- [ ] Pending rewrite: ribbon in assistant slot; composer stays bottom
- [ ] Streaming text: no excessive scroll jitter while reading history
- [ ] History reading: multiline composer resize does not pull an intentionally scrolled thread to the bottom
- [ ] Complete: assistant suggestion + copy action works
- [ ] New conversation: returns composer smoothly to welcome when motion is enabled; no stale poll / ghost streaming
- [ ] Resize window (1280×860): active composer still bottom-anchored
- [ ] Reduced motion: correct layout, send, focus, and streaming behavior with composer travel/resize transitions suppressed

## Independence check

- [x] No `@assistant-ui/*` in `apps/desktop/package.json`
- [x] No new external chat API keys or MCP servers for this feature

## Notes

Implementation on `feat/chat-ui-polish` (or current branch). New modules under `apps/desktop/src/paste-text-chat-runtime/`.

Key behaviors:
- Optimistic turn on send start → `active` phase immediately
- `usePasteTextRunSync` polls every 500ms with cancel on conversation change
- Stream scroll throttled; send uses smooth scroll
- Motion polish (pending): retained composer FLIP transition plus responsive 1–5 line sizing
