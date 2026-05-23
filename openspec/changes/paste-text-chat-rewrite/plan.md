# Implementation Plan · Paste Text Chat Rewrite

## Execution order (Linear)

| Order | Issue | OpenSpec tasks | Deliverable |
|-------|-------|----------------|-------------|
| 1 | WRI-85 | 1.1–1.6 | Backend API + storage + daemon client |
| 2 | WRI-86 | 2.1–2.4 | Copywriter Skill + parser + tests |
| 3 | WRI-87 | 3.1–3.5 | Attachment parse + row rewrite |
| 4 | WRI-88 | 4.1–4.6 | Chat UI on Sources |

## Issue 1 approach (start here)

1. **Contracts first** — `packages/contracts/src/paste-text.ts` with Zod schemas
2. **Storage** — extend `PlatformStore` with `pasteTextConversations` collection
3. **Skill stub** — minimal prompt builder (expanded in Issue 2)
4. **Daemon service** — `paste-text.ts`:
   - `createPasteTextConversation`
   - `sendPasteTextMessage` → create/link session → `buildCopywriterPrompt` → `startAgentRun` → parse output
5. **Routes** — wire in `apps/daemon/src/routes/review.ts` or new `paste-text.ts` router
6. **Tests** — vitest with test registry echo adapter
7. **Desktop client** — methods only

## Issue 2 approach

- Flesh out `copywriter-skill.ts` with role, constraints, fixtures
- Replace stub prompt in daemon with full skill
- Golden-file tests for prompt shape

## Issue 3 approach

- Attachment route + file type detection
- Reuse `parseSpreadsheet` from daemon review-queue
- Row injection in `sendPasteTextMessage`

## Issue 4 approach

- New `PasteTextChatPanel.tsx`
- Refactor `SourcesScreen` — chat primary; Figma tile optional secondary
- Carbon: message bubbles, TextArea composer, icon upload button

## Verification gates

After each issue:
- `npm run typecheck`
- `npm run test`
- Linear: mark issue Done + comment with commit SHA

## Worktree

Use main workspace unless user requests isolated worktree via superpowers `using-git-worktrees`.
