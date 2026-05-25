# Brainstorm · Text Copy Chat Redesign (v2 UX)

> Verbal brainstorm captured 2026-05-25. Builds on `paste-text-chat-rewrite` (v1, completed through tasks 4.6, pending archive). v1 shipped the chat backend, Copywriter Skill, attachment intake, and an in-Settings chat Card. v2 is a UX reshape + a missing-but-required guideline-injection wire-up.

## Background

User-observed gap after v1:

- Home → "Text Copy" card lands on `/settings?tab=review`; the chat sits inside the Settings shell as a Card. Designers/content designers want a dedicated, ChatGPT/Gemini/Claude-style full-screen surface.
- v1 has no proactive bot greeting. Users have to know they should pick a product (via the separate Figma audit panel) before the chat is useful.
- v1 surfaces only streamed text. There is no visible "thinking" / "integrating" phase, so 30–60s waits feel dead.
- v1's composer has a single Paperclip button; user wants a familiar plus-menu pattern with multiple attachment types.
- **Critical gap discovered during brainstorm**: `paste-text.ts` + `copywriter-skill.ts` only consume a single free-text `backgroundContext` string. The three-layer Guidelines stack (Company Base → Software Writing → Product-specific) exists in `apps/daemon/src/guidelines/` but is **not injected into the paste-text rewrite prompt**. Without this, "pick product A → audit by product A's rules" is structurally impossible.

## Decision chain

### Q1: New OpenSpec change vs. extending `paste-text-chat-rewrite`?
**Decision:** New change `text-copy-chat-redesign`. v1 is at 4.6 / archive-pending; bundling v2 work would muddle its acceptance boundary and Linear epic mapping.

### Q2: How does the product picker message live?
**Decision:** **Client-side virtual first message** (Option A).
- Rendered only in the renderer; never POSTed to daemon; never written to `PasteTextConversation.messages`.
- Conversation is created lazily, after the user picks a product (or sends a first text message in the no-products empty-state path).
- LLM prompt history stays clean — picker UI text and option payloads are never serialized into prompts.
- **Trade-off accepted:** if v2.5 needs more rich cards (confirm, citation, approval), we revisit a `parts[]` schema then. Deferred as Open Question.

### Q3: How is "thinking" surfaced?
**Decision:** **Front-end derived phase ribbon** from existing `AgentRunEvent` stream — no daemon contract changes. Phases (collapsed view):
1. `Connecting` — between message POST return and first run event
2. `Loading guidelines` — once the run starts and tool/setup events appear
3. `Thinking` — first `text` event with `streamDelta`
4. `Integrating` — `text` events with `streamFinal: true` or run terminal status incoming

The phase ribbon is a deterministic mapping from event types/timestamps; no LLM `<thinking>` extraction, no new `phase` event type in `packages/contracts`.

### Q4: What's in the plus (+) menu?
**Decision:** v1 ships two items, both reusing existing `POST /paste-text/attachments` backend:
- **Attach spreadsheet** (`.csv`, `.xlsx`) — current `pickPasteTextAttachment` flow
- **Attach text file** (`.md`, `.txt`) — current `pickPasteTextAttachment` flow

Image/screenshot upload is **deferred** — needs new attachment kind + image handling in daemon; out of v1 scope.

### Q5: Empty-state when user has no products?
**Decision:** Bot greeting shows a single message:
> "You haven't added any products yet. Add a product guideline first, then come back to start auditing."

With a primary CTA button that navigates to `/settings?tab=guidelines` (the existing Guidelines screen). No auto-return: the user comes back to `/text-copy` manually. This avoids round-trip state tracking in v1.

### Q6: Route and shell?
**Decision:** New top-level renderer route `/text-copy`. Full-screen layout — no Settings sidebar, no review/sources tabs. A minimal masthead (existing Win11-style) keeps the back affordance + title. Home's "Text Copy" card switches `navigate("/text-copy")`.

### Q7: Three-layer guideline injection (newly surfaced)
**Decision:** **Must-do in v1**, otherwise the picker is decorative. Approach:
- Extend `CopywriterSkillInput` to accept `companyBase?: string`, `softwareWriting?: string`, `productGuideline?: string` (rendered Markdown content from each layer).
- Daemon `paste-text.ts` resolves these from `apps/daemon/src/guidelines/` (reuse `inheritance.ts` + `snapshot.ts`) when conversation is created with a `productId`.
- `buildCopywriterPrompt` concatenates layers in priority order with clear section headers; later layers override / specialize earlier ones (semantically — the LLM is instructed to prefer product → software → company on conflict).
- Conversation snapshot: at creation, daemon snapshots the three rendered guideline blobs onto the conversation (mirrors `review-session-storage` snapshot pattern). Reruns / new turns use the snapshot, not live files — reproducibility.

Stub heuristic: if a layer is absent (e.g. no product guideline), it's omitted from the prompt; no error.

### Q8: Conversation lifecycle and product binding
**Decision:** v1 binds product at conversation creation and **does not allow mid-conversation product change**.
- "Start new conversation" button → clears state, shows greeting + picker again.
- `PasteTextConversation` gains a `productId: string | null` field (`null` when user proceeded without one — only possible via empty-state continuation, which v1 does not allow; so effectively required).
- Companies with zero products: feature is blocked at empty-state CTA; no audit can run.

## Approaches considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| A. Virtual first message + `productId` on conversation + snapshot 3-layer guideline | Minimal contract churn; clean prompt; reproducible | Picker is UI-only; can't replay UI state from history | **Recommended** |
| B. Extend `PasteTextMessage` to `parts[]` array for rich content | Future-proof for confirm / cite / approval cards | 4-layer change (contracts/storage/daemon/desktop); decision cost not justified for one card | Defer to v2.5 |
| C. Push product context as `backgroundContext` string only (no schema change) | Zero backend work | Cannot snapshot; no `productId` on conversation; product change ambiguous | Rejected — fails reproducibility |
| D. Daemon emits `phase` events for thinking ribbon | Most accurate phase timing | Requires `AgentRunEvent` schema extension + adapter changes for each provider | Deferred to v2 |

## Design trade-offs

- **Full-screen route** improves immersion but means we cannot mount the existing Settings layout chrome — chat-specific masthead/back nav must be designed.
- **Lazy conversation creation** (only after product pick) keeps backend free of orphan rows but means the renderer holds transient state (selected product + draft) before the first network call.
- **Snapshot-based guideline injection** trades freshness (edits to `.md` mid-conversation don't apply) for reproducibility — same trade-off `review-session-storage` already made.
- **No product change mid-conversation** simplifies prompt cache + history semantics; cost is occasional "New conversation" friction.

## Open questions (deferred)

- Q-A. Rich message `parts[]` schema — defer until a second rich component is needed.
- Q-B. Persistent product picker re-prompt — should switching product later inside an active conversation be allowed (with snapshot rebuild)? Defer to v2 once usage telemetry is available.
- Q-C. Visualizing the "which layer fired which rule" link (citation back to Company / Software / Product) — depends on whether `finding-validator` rule-id schema gets extended to paste-text rewrites. Currently paste-text outputs free-form text, not findings. Defer.
- Q-D. Streaming the phase ribbon — current plan polls `getAgentRun` every 100ms (same as v1). If perceived lag is noticeable, switch to SSE in v2.

## Acceptance criteria for promotion

1. ✅ Scope locked — v1 In/Out clearly enumerated in proposal.md
2. ✅ Major forks resolved — Q1–Q8 above, no blocking TBDs
3. ✅ Dependencies mapped — paste-text-chat-rewrite (done), guidelines-runtime (done), no new MCP / adapter
4. ✅ Acceptance criteria stateable — `npm run typecheck && npm run test`; manual: home → `/text-copy` → pick product → send copy → see thinking ribbon → copy rewrite; empty-state CTA navigates to Guidelines
5. ✅ Conversation converging

## Approval

User authorized drafting via prompt on 2026-05-25. Proceeding to proposal.md / design.md / specs / tasks. Linear epic + WRI mapping deferred until proposal is reviewed.
