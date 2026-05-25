# Design · Text Copy Chat Redesign

## Context

`paste-text-chat-rewrite` shipped a working chat backend, Copywriter Skill, attachment intake, and an in-Settings UI. Two issues surfaced once content designers tried it:

- The chat is a Card inside `/settings?tab=review` with no proactive guidance. Users don't know they need to set a product, and a dead 30–60s wait during rewrite feels broken.
- Product selection has **no effect on the rewrite** — `copywriter-skill.ts` consumes only a free-text `backgroundContext`, while the three-layer Guidelines stack (Company Base → Software Writing → Product-specific) sits idle in `apps/daemon/src/guidelines/`.

Stakeholders: content designers and PMs auditing UX copy against company + product writing rules.

Architecture invariants (unchanged):

- Renderer never runs CLIs or mutates Figma
- Daemon validates all I/O via `@writer/contracts`
- Active LLM adapter from `platform-store.json`

## Goals

1. Replace the Settings-embedded chat with a full-screen ChatGPT/Gemini/Claude-style surface routed at `/text-copy`.
2. Make product selection proactive and unmistakable via an in-bubble picker on first render.
3. Make the wait legible — show a 4-phase thinking ribbon during pending rewrites without changing daemon contracts.
4. Wire Company / Software / Product Guideline layers into the rewrite prompt so product selection actually drives output.
5. Modernize the composer with a plus-menu pattern, reusing v1's attachment backend.

## Non-Goals

- Image attachments, rich `parts[]` messages, daemon `phase` events, conversation sidebar, SSE streaming, layer-attributed citations, mid-conversation product change (all deferred to v2+).
- A second LLM client. All runs go through `POST /agents/runs` via the active adapter.
- Authoring UI for Guidelines. Authoring stays in the user's text editor.

## Decisions

### D1: New `/text-copy` route (full-screen, no Settings chrome)

**Choice:** Add a top-level route in `apps/desktop/src/app.tsx` mounted to `screens/text-copy-screen.tsx`. The screen renders the existing masthead (back button + title) but no Settings sidebar, no review/sources tabs.

**Rationale:** v1's Card-in-Settings positioning hides the feature and competes for vertical space. Designers expect the dedicated-window feel of mainstream chat tools.

**Alternative rejected:** Keep the Card and just add a greeting — fails the "feels like a real chat tool" requirement.

### D2: Client-side virtual first message for greeting + picker

**Choice:** The bot greeting ("Which product do you need to audit?") and the product list are rendered entirely in the renderer. They are not POSTed to the daemon, not persisted, not included in any LLM prompt history.

Conversation creation is **lazy**: it happens when the user picks a product (or, in the empty-state path, never — the user is sent to Guidelines instead).

**Rationale:** Avoids `PasteTextMessage` schema churn for a single decorative bubble. Keeps prompt history clean. Defers the `parts[]` decision until a second rich component is genuinely needed.

**Alternative rejected:** Extend `PasteTextMessage` to `parts[]` array — large 4-layer change (contracts/storage/daemon/desktop) not justified by a single picker.

### D3: Front-end derived thinking ribbon (no daemon contract change)

**Choice:** A small state machine in `text-copy-thinking-ribbon.tsx` maps the polled `AgentRunEvent` stream (already used by v1's streaming logic in [paste-text-chat-panel.tsx:103-164](apps/desktop/src/paste-text-chat-panel.tsx#L103-L164)) onto a 4-phase ribbon:

| Phase | Trigger |
|-------|---------|
| `connecting` | Pending assistant message exists; no `agentRunId` yet, or `agentRunId` set but zero events returned |
| `loading-guidelines` | First non-text event (tool / setup / status) returned, or first event timestamp within 1.5s of conversation refresh after picker selection |
| `thinking` | First `text` event with `payload.streamDelta === true` |
| `integrating` | A `text` event with `payload.streamFinal === true` OR run status enters terminal set (`completed`, `failed`, `canceled`) but assistant message hasn't refreshed yet |

The ribbon shows only the active phase plus completed checkmarks. Failure surfaces a single `failed` chip; on success it disappears and the assistant bubble takes over.

**Rationale:** Zero contract change; reuses existing poll loop; deterministic from current event schema.

**Alternative rejected:** Daemon emits `phase` events (`AgentRunEvent.type === 'phase'`). Requires schema bump across `packages/contracts` + all three adapter packages; defers cleanly to v2 if perceived accuracy becomes an issue.

### D4: Plus (+) menu replaces single Paperclip

**Choice:** A trigger button in the composer left rail opens a popover (Base UI `Menu` or `Popover`) with two items:

- **Attach spreadsheet** (`.csv`, `.xlsx`) — calls existing `window.writerDesktop.pickPasteTextAttachment()`; daemon flow unchanged.
- **Attach text file** (`.md`, `.txt`) — same backend; only the picker filter changes.

**Rationale:** Matches user expectation of chat-tool composer affordance. Backend is already polymorphic over file kind (`POST /paste-text/attachments` dispatches on extension).

**Trade-off:** Two menu items with identical backends could look redundant; addressed by distinct file-picker filters per item so the macOS dialog defaults to the right extension list.

### D5: Three-layer Guideline injection + conversation snapshot

**Choice:** Extend the data path top-to-bottom:

1. **Contracts** — `PasteTextConversation` adds:
   ```ts
   productId: string;
   guidelineSnapshot?: {
     companyBase?: { id: string; contentHash: string; content: string };
     softwareWriting?: { id: string; contentHash: string; content: string };
     productGuideline?: { id: string; contentHash: string; content: string };
   };
   ```
2. **Daemon** — `paste-text.ts` conversation create handler:
   - Validates `productId` against `getGuidelinesTree()` products.
   - Resolves three layers via `guidelines/inheritance.ts` (`buildInheritedView(productId)`) and persists their rendered Markdown + content hash onto the conversation record (snapshot pattern from `review-session-storage`).
3. **Copywriter Skill** — `CopywriterSkillInput` adds `companyBase?`, `softwareWriting?`, `productGuideline?` (string blobs). `buildCopywriterPrompt` emits them in priority order with section headers:
   ```
   Writing rules (Company Base):
   …
   Writing rules (Software Writing):
   …
   Writing rules (Product: {name}):
   …
   ```
   System prompt gets a new constraint: "When rules conflict, prefer Product > Software Writing > Company Base."
4. **Daemon message handler** — passes the snapshot blobs into `buildCopywriterPrompt`. Live `.md` edits during an active conversation do not apply; reproducibility wins.

**Rationale:** Mirrors `review-session-storage` snapshot trade-offs already accepted by the team. Without snapshot, mid-conversation edits silently change behavior.

**Alternative rejected:** Resolve layers per-message (live read). Cheaper to implement but breaks reproducibility and complicates prompt cache reasoning.

### D6: Conversation creation is lazy and product-bound

**Choice:** Conversation row is created on product pick (first user interaction with the picker). `productId` is required at creation; daemon rejects missing/unknown values. The conversation is immutable in product binding for its lifetime; switching product requires "New conversation" (clears local state and re-shows the greeting).

**Rationale:** Eliminates orphan conversation rows; prompt-cache friendly; product change semantics stay simple (full snapshot rebuild).

### D7: Empty-state CTA → Guidelines screen

**Choice:** When `getGuidelinesTree()` returns zero products, the bot bubble swaps to: "You haven't added any products yet. Add a product guideline first, then come back to start auditing." with a primary CTA that navigates to `/settings?tab=guidelines`. No conversation is created. Composer is disabled.

**Rationale:** Pushes the user to the existing Guidelines authoring path (read-only screen + editor handoff) without inventing in-chat creation. No round-trip state needed.

## Data flow

```text
Home Text Copy card
  → navigate("/text-copy")
TextCopyScreen mounts
  → getGuidelinesTree()                       (daemon)
  → if products.length === 0: render empty-state bubble + CTA; stop
  → else: render greeting bubble + ProductPicker
User clicks product
  → POST /paste-text/conversations { projectId, productId, backgroundContext: undefined }
      Daemon:
        - Validates product exists
        - buildInheritedView(productId) → { companyBase, softwareWriting, productGuideline }
        - Persists conversation with guidelineSnapshot
  → Renderer stores conversation, replaces picker bubble with a thin "Auditing {product}" header
User types + sends message
  → POST /paste-text/conversations/:id/messages { text }
      Daemon:
        - buildCopywriterPrompt({
            companyBase, softwareWriting, productGuideline,  // from snapshot
            history,
            userText,
            ...
          })
        - startAgentRun(...) → agentRunId
        - return { userMessage, assistantMessage(status=pending, agentRunId) }
  → Renderer:
        - Appends user bubble
        - Renders ThinkingRibbon driven by getAgentRun(agentRunId) poll
        - On run terminal: refresh conversation → swap pending bubble for final assistantMessage
User clicks plus → "Attach spreadsheet"
  → window.writerDesktop.pickPasteTextAttachment() → filePath
  → POST /paste-text/attachments { conversationId, filePath }
  → conversation.inputMode flips to structured_file; row controls appear (reuse v1 UX)
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Plus-menu redundancy (two items, same backend) | Distinct file picker filters per item; clear icons |
| Snapshot staleness vs. mid-conversation guideline edits | Documented behavior + "New conversation" reload path; matches review-session-storage trade-off |
| Phase ribbon drifts from reality (e.g. fast LLM skips `loading-guidelines`) | Phase machine collapses skipped phases; minimum 200ms display per phase to avoid flicker |
| Conversation orphan if user pre-picks product then closes window before sending | Daemon cron / startup sweep prunes empty conversations >24h old (added in tasks) |
| Three-layer prompt size exceeds adapter context window | Cap each layer at N tokens (configurable; default high); document overflow as `prompt-truncated` event when adapters support it |
| User has only company + software layers (no product) | Empty-state CTA blocks proceed; not a runtime risk |

## Migration Plan

1. Ship contracts + daemon changes first (`productId` required, guideline snapshot). Update v1's existing in-Settings Card to also pass `productId` (sourced from `useWorkspace().selectedProductId`) so it doesn't break.
2. Ship Copywriter Skill three-layer extension with tests.
3. Ship `TextCopyScreen` + supporting components behind no flag (single route addition).
4. Switch Home card route from `/settings?tab=review` to `/text-copy`.
5. Leave the in-Settings Card mounted but mark it deprecated in `paste-text-chat-panel.tsx`'s comment; full removal in a follow-up change once analytics confirm no entry from that path.

Rollback: revert Home card `onClick` to `/settings?tab=review`. New `/text-copy` route is additive and harmless if unrouted. Contracts changes (`productId` required) are the only hard breaks — rollback would require a follow-up contract relaxation, so this is the boundary commit.

## Open Questions

- Should `New conversation` confirmation prompt if there's an in-flight rewrite? **Lean yes** (cancel run); decide during tasks.
- Plus-menu keyboard affordance (Cmd-Shift-A?) — defer to UX polish pass post-v1.
- Per-layer token cap configuration — default high; expose via daemon config later if needed.
