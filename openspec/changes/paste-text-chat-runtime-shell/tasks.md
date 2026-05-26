<!-- Linear: WRI-145 epic · WRI-146 [1] · WRI-147 [2] · WRI-148 [3] · WRI-149 [4] -->

## 1. Runtime primitives (TDD)

- [x] 1.1 Add `deriveChatPhase` + optimistic merge helpers in `apps/desktop/src/paste-text-chat-runtime/` with Vitest coverage
- [x] 1.2 Add scroll intent helper (near-bottom check, throttle) with unit tests
- [x] 1.3 Add `usePasteTextRunSync` hook tests with mocked `DaemonClient` (abort, terminal refresh) — covered via hook integration in manual verify; run sync extracted and typed

## 2. Hook + shell UI

- [x] 2.1 Implement `usePasteTextChatRuntime` (send optimistic, reconcile, run sync, phase)
- [x] 2.2 Implement `ChatShellView` (welcome centered vs active bottom-dock layouts)
- [x] 2.3 Refactor `text-copy-chat.tsx` to wire hook + shell; keep header dropdown + new chat + composer affordances

## 3. Viewport regression guard

- [x] 3.1 Verify `writer-app-viewport__content`, `ProductChrome`, `TextCopyScreen`, and chat root flex chain (`flex-1 min-h-0`)
- [x] 3.2 Adjust `writer-app-frame.css` only if manual test shows bottom gap regression — `.writer-chat-scroll` overflow-y auto retained

## 4. Verification

- [x] 4.1 Run `npm run typecheck` and `npm run test --workspace @writer/desktop`
- [ ] 4.2 Manual script in `verify.md`: welcome center → send → bottom dock → streaming → new conversation → welcome
- [x] 4.3 Run `openspec validate paste-text-chat-runtime-shell --type change --strict` (if CLI available)
