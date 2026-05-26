## Why

Chat (`/text-copy`) already has async daemon sends and a thinking ribbon, but the **client runtime** still feels stiff: the composer can sit mid-viewport after the first message, sends wait on HTTP before the layout switches, and scroll/polling logic is embedded in one large component. Designers expect a Gemini-like flow—centered welcome, then a stable bottom composer—without adopting third-party chat products.

## What Changes

**Chat shell phases (welcome → active)**

- From: layout driven implicitly by `conversation.messages.length` after API returns.
- To: explicit `welcome` | `active` phases; entering `active` on send start with optimistic user + pending assistant rows.
- Reason: immediate, natural transition like mainstream chat apps.
- Impact: new `ChatShellView` + phase derivation; `TextCopyChat` thins to wiring.

**Runtime hook extraction**

- From: send, poll, stream merge, and scroll effects inline in `text-copy-chat.tsx`.
- To: `usePasteTextChatRuntime` (or equivalent) owning daemon calls, optimistic merge, run sync, abort on unmount/new chat.
- Reason: testable, stable concurrency; UI only subscribes.
- Impact: new module under `apps/desktop/src/` with Vitest coverage.

**Viewport + scroll policy**

- From: partial flex chain; smooth scroll on every stream delta.
- To: documented viewport contract from `ProductChrome` through chat root; throttled scroll-to-bottom (new message / user at bottom only).
- Reason: composer truly sticks to bottom; less jank during streaming.
- Impact: `writer-app-frame.css` rules if needed; scroll helper tests.

**Composer motion continuity + adaptive height**

- From: welcome and active layouts swap the composer instantly; browser content sizing changes multiline input height without a visible transition.
- To: preserve one composer instance across shell phases, animate its first-send movement from center to bottom, and animate its visible input height from 1 to 5 lines before internal scrolling.
- Reason: eliminate the current flash/jump while preserving focus, draft state, and a fast typing experience.
- Impact: `ChatShellView`, `WriterChatComposer`, chat motion styles, and targeted desktop tests/manual verification.

**Spec alignment**

- Update `desktop-shell` delta for Chat title, shell phases, viewport contract.
- Add `paste-text-chat-runtime` capability spec for client orchestration requirements.
- Mark obsolete virtual product-picker-first-load scenarios as superseded where implementation diverged.

## Capabilities

### New Capabilities

- `paste-text-chat-runtime` — desktop client phase machine, optimistic turns, run polling coordination, scroll policy, and composer motion behavior.

### Modified Capabilities

- `desktop-shell` — Chat route shell layout (welcome centered composer, active bottom dock and continuous transition); masthead title "Chat".

## Impact

- **apps/desktop** — `text-copy-chat.tsx`; `components/writer/writer-chat-composer.tsx`; `paste-text-chat-runtime/` shell/runtime modules; chat styles; tests.
- **apps/desktop/src/styles/writer-app-frame.css** — optional scroll/shell utilities.
- **openspec/specs/** — sync after archive via `/opsx-sync`.

No changes to `packages/contracts`, `apps/daemon`, or agent adapters in v1.

## Non-Goals (v1)

- Installing or referencing **assistant-ui** (npm, CLI, registry, skills, docs API, cloud).
- Any new third-party chat backend, MCP, or hosted thread service.
- SSE/WebSocket push (polling stays).
- Multi-thread sidebar, model picker UI, or Gemini-style suggestion chips.
- Daemon contract or `AgentRunEvent` schema changes.
- Full visual redesign of message bubbles (keep Writer Carbon styling).
- Decorative bounce/spring motion, prolonged choreography, or global changes to the shared `Textarea` component.
