# Brainstorm · Figma Audit Redesign (v2 UX + audit-run list + page browse + writeback flow)

> Verbal brainstorm captured 2026-05-25. Builds on the completed `figma-mcp-extraction`, `review-session-storage`, and writeback infrastructure (WRI-24, WRI-101, WRI-47). v2 is a UX reshape + a few targeted backend additions (list-page-frames, frame screenshot capture).

## Background

Writer already has:

- Figma MCP extraction with `frame` / `page` / `flow` scope ([`openspec/specs/figma-mcp-extraction/spec.md`](openspec/specs/figma-mcp-extraction/spec.md))
- Audit pipeline that injects guidelines into the prompt ([`apps/daemon/src/review.ts`](apps/daemon/src/review.ts))
- Review session storage with guideline snapshot
- Review queue + edit-before-approve + bulk transition state machine
- Figma writeback with permission gating ([`apps/daemon/src/figma-writeback.test.ts`](apps/daemon/src/figma-writeback.test.ts), [`apps/daemon/src/figma-write-permission.ts`](apps/daemon/src/figma-write-permission.ts))
- Export to MD/JSON/PDF
- Three-layer Guidelines (Company Base → Software Writing → Product) wired into `audit.run`

What users observed:

1. **Entry is buried.** Home → "Figma Copy" card → `/settings?tab=sources`. No proactive structure ("which feature? what to audit?"), no product picker, no mode choice. Users have to know the URL is the only input expected.
2. **No multi-session list.** Current `/review` shows only the active session — there is no "Reviewlog" / audit-history surface where users can see In Progress vs Done across runs.
3. **Detail page lacks structure.** Findings are listed in a queue panel, not laid out as the user described: per-frame screenshot + a table (#, element type, original copy, AI suggestion, rule link → modal, user edit pre-populated with AI suggestion).
4. **No rule modal.** Findings carry `ruleId` but the UI doesn't open a modal showing the rule content + source layer.
5. **Workflow mode UX is absent.** Backend supports the `flow` scope, but the renderer has no flow input UI.
6. **No frame screenshot in detail.** Visual context (the actual Figma frame image) is not shown alongside the suggestions.
7. **Writeback feedback is fragmented.** Approve and writeback exist but the happy/error paths aren't surfaced on a unified audit-run row.

## Decision chain

### Q1: New OpenSpec change vs extending an existing one?
**Decision:** New change `figma-audit-redesign`. Mirrors the `text-copy-chat-redesign` pattern — v1 backend is reused, v2 reshapes UX and closes a few targeted backend gaps.

### Q2: Product binding — required or optional?
**Decision:** **Optional.** The user explicitly said "可以不选" (can choose not to select). Differs from `text-copy-chat-redesign`'s required `productId`.

- If product selected → inject all three guideline layers (Company Base + Software Writing + Product-specific)
- If product omitted → inject only Company Base + Software Writing
- Storage: `FigmaSession.productId?: string` (optional)
- Prompt assembly: existing three-layer logic from `text-copy-chat-redesign` reused; missing Product layer is simply omitted

### Q3: Workflow mode input UX
**Decision:** **Both Paste-links (A) and Browse-page (B).** Two tabs / segmented control inside Workflow mode.

**Browse-page (B), clarified spec:**

- Input: one Figma **page** URL (`figma.com/design/:fileKey/...?node-id=PAGE_ID`) — cloud, not local file picker
- Backend: new `POST /figma/list-page-frames { pageUrl }` → MCP `get_metadata` on the page → returns frames with their `boundingBox` positions
- Auto-detect flow direction by spatial layout:
  - Sum bounding-box span on x-axis vs y-axis
  - Wider total span → `horizontal` (left-to-right ordering by `x`)
  - Taller total span → `vertical` (top-to-bottom ordering by `y`)
  - Fallback (grid layouts where spans are similar): row-major (`y` first, then `x`)
- Renderer shows the ordered list with the detected direction visible ("Detected flow direction: ← left to right"). User can drag-reorder or uncheck frames; default selection is all frames in detected order.
- No thumbnails in v1 — plain text list with parent-path breadcrumb is enough. Thumbnails deferred to v2.

### Q4: Reject-AI semantics (user edit field == original text)
**Decision:** **Auto-skip.** If the user's final text equals the Figma original text exactly, that node is skipped at writeback — no Figma mutation, no error. No explicit per-row Skip toggle. Predictable, zero extra UI.

### Q5: Partial writeback failure
**Decision:** **Partial commit + retry.** Successful node writes commit. Failed nodes are recorded on the session with their errors and surface in the audit-runs list as "N written, M failed (click to retry)". Figma has no cross-node transaction primitive; pretending otherwise is misleading.

### Q6: List + detail routing
**Decision:** **New `/audits` (list) + `/audits/:sessionId` (detail).** Existing `/review` route stays mounted as deprecated back-compat. The list page replaces what the current `/review` partly does (showing per-session info), and offers a true cross-session table.

### Q7: Frame screenshots
**Decision:** **Capture at audit time, store on session.** When the audit run completes, daemon calls MCP `get_screenshot` for each in-scope frame and persists the image (or image reference) onto the session record. Detail page loads them inline. Avoids per-page lazy fetch latency; cost is small relative to the 30–60s audit itself.

## Approaches considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| A. Optional product + new `/figma-audit` + `/audits` + auto-skip + partial writeback | Mirrors text-copy-chat-redesign pattern; reuses 80% of existing infra | UX reshape touches many components | **Recommended** |
| B. Required product (consistent with text-copy v2) | Symmetric API across audit surfaces | Contradicts explicit user preference; some Figma audits don't have a product yet | Rejected |
| C. Single mode only (no Workflow) | Simpler v1 | Loses the multi-step audit use case the user explicitly described | Rejected |
| D. Browse-page input only (drop Paste-links) | Cleaner | Forces user to have a page URL; loses the "I already know which 3 frames" fast path | Rejected — user wants both |

## Design trade-offs

- **Auto-detected flow direction** is heuristic — wrong on irregular layouts. Mitigated by showing the detected direction explicitly and letting the user reorder.
- **Capture-time screenshots** add ~1–3s per frame to audit total time. Acceptable trade for instant detail-page loads.
- **Auto-skip on user-text == original** is convenient but means users cannot "approve no-op" to confirm they reviewed the row. Logged metric: number of skipped vs touched nodes per session, surfaced on the audit-runs row.
- **Partial commit** means rolling back is the user's responsibility (re-run audit + writeback). Acceptable because writes are idempotent at the node level.
- **Three-layer prompt injection** depends on `copywriter-skill.ts` having been extended by `text-copy-chat-redesign`. If that change ships first, this one inherits the wiring for free. If shipped in parallel, this change includes the same extension as a contributing change (not a duplicate definition).

## Open questions (deferred)

- Q-A. Frame thumbnails in Browse-page list — defer to v2 once usage telemetry shows long frame lists are common.
- Q-B. Audit-run cancellation UX (kill mid-run) — defer; users can just wait or restart.
- Q-C. Per-row inline writeback (vs batched at Approve time) — defer; batch is enough and simpler.
- Q-D. Workflow mode "consistency check" (e.g. same button label across step 1 vs step 3) — defer; valuable but its own feature.
- Q-E. Multi-user collaboration / comment threads on findings — defer.
- Q-F. Remove `/review` route entirely — defer until analytics confirm no entry. Same pattern as `paste-text-chat-panel.tsx` deprecation in `text-copy-chat-redesign`.

## Acceptance criteria for promotion

1. ✅ Scope locked — v1 In/Out enumerated in proposal.md
2. ✅ Major forks resolved — Q1–Q7 above, no blocking TBDs
3. ✅ Dependencies mapped — `figma-mcp-extraction` (done, extending for list-page-frames + screenshot), `review-session-storage` (done, extending fields), writeback infra (done), `guidelines-runtime` (done), `text-copy-chat-redesign` three-layer prompt extension (in-flight; either shipped first or contributed here)
4. ✅ Acceptance criteria stateable — `npm run typecheck && npm run test`; manual: Home → Figma Audit → fill form → pick Single or Workflow → run → /audits list shows row → Open detail → use rule modal + edit + Approve & writeback → row reflects "Done, written back" or partial-commit state
5. ✅ Conversation converging

## Approval

User authorized drafting via prompt on 2026-05-25 after confirming corrected D3 (Browse page = cloud page URL, not local file). Proceeding to proposal / design / specs / tasks artifacts + Linear epic.
