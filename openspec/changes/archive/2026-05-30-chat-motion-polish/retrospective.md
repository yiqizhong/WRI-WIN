# Retrospective: codex/chat-motion-polish (abandoned prototype)

> **Branch disposition (2026-05-30):** `codex/chat-motion-polish` archived **without merge** and deleted. Motion work shipped on `main` under `paste-text-chat-runtime-shell` tasks 5.1–5.5 (WRI-154 / WRI-155).

## Scope

Early spike for Text Copy composer motion: welcome-centered composer FLIP-travels to the active footer dock on first send, with reverse path on New Chat.

## Commits (branch-only)

```text
6f2c43b feat(text-copy): animate composer phase transition
74b82ee fix(text-copy): arm composer travel transition
```

**Base:** `0c12a61` (`docs(openspec): plan chat motion polish increment`) — already on `main`.

## Files touched (prototype)

- `apps/desktop/src/paste-text-chat-runtime/chat-shell-view.tsx`
- `apps/desktop/src/paste-text-chat-runtime/composer-motion.ts`
- `apps/desktop/src/paste-text-chat-runtime/composer-motion.test.ts`
- `apps/desktop/src/styles/writer-chat-welcome.css`
- `apps/desktop/src/text-copy-chat.tsx`

## Why not merged

`main` superseded this spike with a fuller implementation:

- Persistent single-composer shell with `welcomeSendTransition`
- `composer-welcome-send-motion.ts` (WAAPI)
- Extended timing/layout helpers in `composer-motion.ts`
- Multiline composer height animation (WRI-155)

Merging the branch would regress `main` motion and unrelated post-spike polish.

## Supersession reference

- OpenSpec change: `openspec/changes/paste-text-chat-runtime-shell/`
- Linear: WRI-145 epic · WRI-154 · WRI-155
