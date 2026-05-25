## Why

`paste-text-chat-rewrite` (v1) gave Writer a working chat backend and an in-Settings Card. Two gaps remain before content designers can rely on it as a daily tool:

1. **UX is buried and passive** — the chat lives in a Settings tab, never greets the user, never tells them what to do next, and shows a dead-screen wait during 30–60s rewrites.
2. **Three-layer Guidelines are not injected into the rewrite prompt** — Company Base / Software Writing / Product-specific Markdown files exist in `~/.writer/guidelines/` and are parsed by the daemon, but `copywriter-skill.ts` only consumes a single free-text `backgroundContext`. Selecting a product currently has no effect on the rewrite output.

This change reshapes the surface (full-screen chat, proactive product picker, visible thinking ribbon, plus-menu composer) and closes the guideline-injection gap so product selection actually drives rule grounding.

## What Changes

- Add **`/text-copy` full-screen route** — replaces Home → `/settings?tab=review` landing for Text Copy. No Settings sidebar, no review/sources tabs.
- Add **proactive bot greeting + product picker** — first render shows an assistant-style bubble: "Which product do you need to audit?" with a clickable list of products discovered from the Guidelines tree.
- Add **empty-state path** — when zero products exist, greeting prompts user to add one with a CTA to `/settings?tab=guidelines`.
- Add **thinking ribbon** — pending assistant turns render a 4-phase indicator (Connecting → Loading guidelines → Thinking → Integrating) derived from `AgentRunEvent` stream; no daemon contract changes.
- Add **plus (+) composer menu** — single trigger expanding to "Attach spreadsheet" and "Attach text file"; same backend as v1.
- Wire **three-layer guideline injection** — daemon snapshots Company Base + Software Writing + active Product guideline at conversation creation; `buildCopywriterPrompt` injects them in priority order; conversation persists the snapshot.
- Bind **`productId` on `PasteTextConversation`** — required at creation; enforced by daemon; immutable for the conversation's lifetime.

## Capabilities

### New Capabilities

None. This change extends two existing capabilities.

### Modified Capabilities

- `paste-text-chat` — conversation gains required `productId` and three-layer `guidelineSnapshot`; Copywriter Skill input extended with `companyBase`, `softwareWriting`, `productGuideline` blocks; create endpoint validates product exists.
- `desktop-shell` — new `/text-copy` route + `TextCopyScreen`; Home card re-routes; existing `PasteTextChatPanel` is refactored into a chat-page layout (or replaced by a new screen consuming the same daemon client methods).

## Impact

- **packages/contracts** (`paste-text.ts`) — `PasteTextConversation` adds `productId: string` and `guidelineSnapshot?: { companyBase?, softwareWriting?, productGuideline? }`; create request validates `productId`.
- **packages/review-core** (`copywriter-skill.ts`) — `CopywriterSkillInput` adds three optional Markdown blobs; system prompt updated to reference layer priority on conflict; tests cover layer omission permutations.
- **apps/daemon** (`paste-text.ts`, `routes/paste-text.ts`) — conversation creation resolves three guideline layers via `guidelines/inheritance.ts` + `guidelines/snapshot.ts`; rejects unknown `productId`; message handler passes snapshot to prompt builder.
- **apps/desktop** —
  - New `screens/text-copy-screen.tsx` (full-screen chat layout).
  - New `text-copy-chat.tsx` (chat panel adapted from `paste-text-chat-panel.tsx`, dropping Background field and Card chrome).
  - New `text-copy-product-picker.tsx` (in-bubble selector).
  - New `text-copy-thinking-ribbon.tsx` (4-phase indicator derived from `AgentRunEvent`).
  - New `text-copy-attachment-menu.tsx` (plus-menu wrapping existing `pickPasteTextAttachment`).
  - Route added in `app.tsx`; Home card `onClick` switched in `screens/home-screen.tsx`.
- **`~/.writer/guidelines/`** — no schema change; consumed read-only.
- **PRODUCT.md** — note "Text Copy chat audits using product-specific guideline layers".
- **docs/linear-openspec-map.md** — add `text-copy-chat-redesign` → new WRI epic mapping (proposed: WRI-110 + 4 child issues, exact numbers TBD by Linear sync).

## Non-Goals (v1)

- Image / screenshot attachments in the plus menu
- Rich-content message schema (`PasteTextMessage.parts[]`)
- Mid-conversation product change (must "New conversation")
- Daemon-emitted `phase` events (front-end derives ribbon)
- Persistent / sidebar history of past conversations on the chat page
- Streaming SSE replacement of the existing 100ms poll
- Citing which layer (Company / Software / Product) fired which rewrite suggestion
- Codex / Claude adapter registration (still cursor-agent + devin only)
