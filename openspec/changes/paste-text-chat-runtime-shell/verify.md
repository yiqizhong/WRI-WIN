# Verify · paste-text-chat-runtime-shell

> Fill in during `/opsx-apply` and before archive.

## Automated

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass (all workspaces) |
| `npm run test --workspace @writer/desktop` | Pass — 13 files, 42 tests |
| `openspec validate paste-text-chat-runtime-shell --type change --strict` | Pass |

## Manual (Chat `/text-copy`)

- [ ] Fresh load: greeting + composer visually centered; no thread list
- [ ] First send: within ~100ms, user bubble visible; composer at window bottom (not mid-screen)
- [ ] Pending rewrite: ribbon in assistant slot; composer stays bottom
- [ ] Streaming text: no excessive scroll jitter while reading history
- [ ] Complete: assistant suggestion + copy action works
- [ ] New conversation: returns to welcome; no stale poll / ghost streaming
- [ ] Resize window (1280×860): active composer still bottom-anchored

## Independence check

- [x] No `@assistant-ui/*` in `apps/desktop/package.json`
- [x] No new external chat API keys or MCP servers for this feature

## Notes

Implementation on `feat/chat-ui-polish` (or current branch). New modules under `apps/desktop/src/paste-text-chat-runtime/`.

Key behaviors:
- Optimistic turn on send start → `active` phase immediately
- `usePasteTextRunSync` polls every 500ms with cancel on conversation change
- Stream scroll throttled; send uses smooth scroll
