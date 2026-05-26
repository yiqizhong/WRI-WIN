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
- **Continuous first-send motion** so the welcome composer visibly becomes the active bottom composer.
- **Responsive multiline composer** so 1–5 visible input lines grow and shrink without a jump.
- **Single run sync loop** with abort semantics for new conversation / unmount / product change.
- **Stable viewport** so active composer anchors to window bottom.
- Unit tests for phase derivation, optimistic merge, and scroll policy.

**Non-Goals:**

- assistant-ui, Vercel AI SDK, Assistant Cloud, or their skills/MCP.
- New daemon routes or streaming transport.
- Reintroducing mandatory first-load product picker bubble (product remains header dropdown).
- Decorative animation systems, spring/bounce effects, or global textarea behavior changes.

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
        ├─ persistent composer node + welcome/active layout anchors
        ├─ welcome: flex-1 center column (greeting + composer anchor)
        └─ active: flex-1 overflow thread + shrink-0 bottom composer anchor
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

### D8: Persistent composer and first-send FLIP transition

- **Choice:** Render `WriterChatComposer` once across `welcome` and `active`; `ChatShellView` changes the layout anchor while retaining the textarea instance, draft, selection, and focus.
- **Motion:** On the first transition to `active`, capture the composer's pre-layout and post-layout rectangles, invert the positional delta with `transform`, then play it to its bottom-docked position over `240ms` using `cubic-bezier(0.65, 0, 0.35, 1)`.
- **Choreography:** Fade/raise the welcome heading over `160ms`; enter the optimistic user message with `opacity` plus `translateY(16-20px)` over `180ms`, offset by roughly `70ms` after the composer starts moving.
- **Return:** `New Chat` runs the same transform-based transition in reverse when no pending generation blocks the reset.
- **Reduced motion:** When `prefers-reduced-motion: reduce` matches, change anchors without interpolation and do not animate the heading or message entrance.
- **Rejected:** Separate welcome and active composer instances with entrance-only CSS; that cannot preserve perceived object identity or focus reliably.
- **Rejected:** View Transitions snapshots for the text field; the live editable control and interruption semantics are more reliable with a retained React node.

### D9: Composer height controller

- **Choice:** Keep the shared `Textarea` primitive untouched. `WriterChatComposer` owns Chat-only height measurement and clamps visible growth from 1 to 5 text lines.
- **Measure:** After a value/layout-width change, derive a pixel target from the live textarea's content height and line-height, clamp to the 1-line and 5-line bounds, then apply the target to the field container.
- **Motion:** Transition the controlled height over `150ms` with `cubic-bezier(0.32, 0.72, 0, 1)` for both growth and shrink; do not use bounce or overshoot.
- **Overflow:** Once content exceeds 5 visible lines, stop growing the footer and allow vertical scrolling inside the textarea.
- **Behavior:** Clearing after send smoothly returns the composer to one visible line without remounting or moving focus.
- **Rejected:** Depending on `field-sizing-content` for Chat; intrinsic sizing yields instantaneous jumps and does not provide an animatable target.

### D10: Motion and scroll coordination

- **Choice:** Retain the existing footer `ResizeObserver` boundary: resizing the composer maintains the thread bottom only while the user is already near the latest message.
- **First send:** Anchor active layout and run the composer transform transition before the final bottom-scroll correction, so scroll updates do not fight the moving composer.
- **History reading:** If the user has scrolled away from the bottom, editing a multiline draft must not reposition their visible message history.
- **Accessibility:** Motion is presentation only; keyboard send rules, IME composition behavior, error handling, and optimistic-send semantics stay intact.

## Affected paths

| Path | Change |
|------|--------|
| `apps/desktop/src/text-copy-chat.tsx` | Thin view; delegate to hook + shell |
| `apps/desktop/src/components/writer/writer-chat-composer.tsx` | Chat-only animated multiline height controller and send feedback |
| `apps/desktop/src/paste-text-chat-runtime/chat-shell-view.tsx` | Persistent composer anchor and first-send FLIP transition |
| `apps/desktop/src/paste-text-chat-runtime/` | phase, hook, run sync, scroll/motion coordination |
| `apps/desktop/src/styles/writer-chat-welcome.css` | Motion tokens, heading/user-message entrance, reduced-motion rules |
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
| Composer transition loses focus or selection | Retain a single live composer node; animate transform only |
| Height animation compresses reading area unexpectedly | Cap at 5 lines and preserve near-bottom-only scroll correction |
| Motion causes accessibility discomfort | Apply `prefers-reduced-motion` no-transition fallback |

## Verification

- `npm run typecheck`
- `npm run test --workspace @writer/desktop`
- Manual: welcome center → type/delete 1–5+ lines → first send transition → bottom dock → stream → new conversation → welcome
- Manual with reduced motion: same functional path with no composer travel or size interpolation
