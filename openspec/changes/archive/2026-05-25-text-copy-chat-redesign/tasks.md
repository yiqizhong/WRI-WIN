# Tasks · Text Copy Chat Redesign

Maps to Linear epic **WRI-126**. Order follows contracts → daemon → adapters/runtime → desktop → integration per repo conventions.

## 1. Contracts: productId + guidelineSnapshot on conversation (WRI-127)

- [x] 1.1 Extend `packages/contracts/src/paste-text.ts`:
  - `PasteTextConversation` adds required `productId: string` and optional `guidelineSnapshot` with `{ companyBase?, softwareWriting?, productGuideline? }` each `{ id, contentHash, content }`
  - `CreatePasteTextConversationRequest` adds required `productId`
- [x] 1.2 Update Zod parsers (`parsePasteTextConversation` etc.) + exported types
- [x] 1.3 Contract tests: round-trip parse with/without each snapshot layer
- [x] 1.4 Verification: `npm --workspace @writer/contracts run test`

## 2. Daemon: snapshot resolution + create validation (WRI-128)

- [x] 2.1 Wire `apps/daemon/src/paste-text.ts` create handler:
  - Validate `productId` via `getGuidelinesTree()`; reject unknown/empty
  - Call `buildInheritedView(productId)` (or current equivalent in `guidelines/inheritance.ts`); convert to snapshot `{ id, contentHash, content }` per layer
  - Persist snapshot on conversation record (`apps/daemon/src/storage` or wherever conversations live)
- [x] 2.2 Update route validator in `apps/daemon/src/routes/paste-text.ts` to require `productId`
- [x] 2.3 Unit + integration tests in `apps/daemon/src/paste-text.test.ts`:
  - Reject create with missing productId
  - Reject create with unknown productId
  - Reject create when tree has zero products
  - Snapshot persisted with correct content hashes
- [x] 2.4 Backfill / migration consideration: existing v1 conversations have no productId; add a one-time storage migration that either deletes them or marks them as legacy non-auditable
- [x] 2.5 Verification: `npm --workspace @writer/daemon run test`

## 3. Copywriter Skill: three-layer prompt injection (WRI-129)

- [x] 3.1 Extend `CopywriterSkillInput` in `packages/review-core/src/copywriter-skill.ts` with `companyBase?`, `softwareWriting?`, `productGuideline?` (strings)
- [x] 3.2 `buildCopywriterPrompt` emits up to three `Writing rules (…)` sections in priority order before existing background/history/userText sections
- [x] 3.3 `SYSTEM_PROMPT` gains conflict-resolution line: "When writing rules conflict, prefer Product over Software Writing over Company Base."
- [x] 3.4 Daemon message handler in `paste-text.ts` reads `conversation.guidelineSnapshot` and passes blobs to prompt builder
- [x] 3.5 Tests in `packages/review-core/src/copywriter-skill.test.ts`:
  - All three layers present → three sections in order
  - Only Company + Product → two sections, no placeholder
  - Conflict-resolution line always present when any layer set
  - History + userText still emitted after rules sections
- [x] 3.6 Verification: `npm --workspace @writer/review-core run test`

## 4. Backward-compat for existing in-Settings Card (WRI-130)

- [x] 4.1 Update `apps/desktop/src/paste-text-chat-panel.tsx` to pass `productId: selectedProductId` to `createPasteTextConversation`; show inline error if no product selected
- [x] 4.2 Add deprecation comment at top of the file pointing to `screens/text-copy-screen.tsx`
- [x] 4.3 Verification: existing flow still works via `/settings?tab=review`

## 5. Desktop: new TextCopyScreen + supporting components (WRI-131)

- [x] 5.1 New route `/text-copy` in `apps/desktop/src/app.tsx` mounting `screens/text-copy-screen.tsx`
- [x] 5.2 `screens/text-copy-screen.tsx`:
  - Full-screen flex layout (no Settings sidebar)
  - Existing masthead with back button + "Text Copy" title
  - Owns conversation state, ribbon state, picker state
- [x] 5.3 `text-copy-product-picker.tsx`:
  - Virtual assistant bubble with greeting
  - Renders product options from `getGuidelinesTree()`
  - Emits `onPick(productId)` upward
- [x] 5.4 Zero products: optional path — "Start audit" without product + optional CTA to Guidelines; with products, "Continue without product-specific guidelines"
- [x] 5.5 `text-copy-thinking-ribbon.tsx`:
  - Pure component receiving `{ runStatus, events }`
  - Internal state machine maps to phase (`connecting | loading-guidelines | thinking | integrating`)
  - 200ms minimum display per phase to prevent flicker
  - Failure surface
- [x] 5.6 `text-copy-attachment-menu.tsx`:
  - Plus trigger button + Base UI menu/popover
  - Items: "Attach spreadsheet" (.csv/.xlsx), "Attach text file" (.md/.txt)
  - Each calls existing `window.writerDesktop.pickPasteTextAttachment` and `POST /paste-text/attachments`
  - Disabled states wired
- [x] 5.7 `text-copy-chat.tsx` (chat surface):
  - Message list (reuse v1 bubble/copy logic)
  - Composer with plus-menu on left, send button on right
  - Ribbon mounted into pending assistant bubble slot
- [x] 5.8 Home card `onClick` swap in `apps/desktop/src/screens/home-screen.tsx`: `navigate("/text-copy")`
- [x] 5.9 New conversation control with in-flight confirm dialog
- [x] 5.10 Component-level vitest tests for picker, ribbon, attachment menu (pure logic)
- [x] 5.11 Verification: `npm --workspace @writer/desktop run test && npm --workspace @writer/desktop run typecheck`

## 6. End-to-end manual verification (WRI-132)

- [x] 6.1 Launch app: `npm run dev`
- [x] 6.2 With ≥1 product: Home → Text Copy → see greeting + picker → pick product → send copy → observe ribbon (connecting → loading-guidelines → thinking → integrating) → see rewrite → copy
- [x] 6.3 Upload `.csv` via plus-menu → send message with row index → see rewrite for that row
- [x] 6.4 Upload `.md` via plus-menu → send message → see rewrite using attached context
- [x] 6.5 With zero products: Home → Text Copy → "Start audit" works without product → optional CTA to Guidelines to add product later
- [x] 6.6 Disconnected daemon: plus + send disabled with clear messaging
- [x] 6.7 New conversation during pending rewrite: confirm dialog cancels and resets
- [x] 6.8 Settings tab fallback: `/settings?tab=review` still works (back-compat)

## 7. Documentation + Linear sync

- [x] 7.1 Update `PRODUCT.md` to mention three-layer guideline grounding in Text Copy chat
- [x] 7.2 Update `docs/linear-openspec-map.md` with new WRI epic + child mapping
- [x] 7.3 Per-task: check off this file, commit (one task per commit preferred), update mapped WRI issue per `AGENTS.md` rules
- [x] 7.4 On archive: write `verify.md` and run `/opsx:verify` + `/opsx:archive`

## Verification commands

- `npm run typecheck`
- `npm run test`
- Manual flow per section 6
