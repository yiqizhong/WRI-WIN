# Tasks · Figma Audit Redesign

Maps to Linear epic **[WRI-134](https://linear.app/uicb/issue/WRI-134)**. Order follows contracts → daemon → review-core → desktop → integration per repo conventions.

## 1. Contracts: session intent fields + page-frames request/response (WRI-TBD)

- [x] 1.1 Extend `packages/contracts/src/review-session.ts` (or equivalent):
  - `FigmaSession` adds required `featureName: string`, required `description: string`, optional `productId?: string`, optional `frameScreenshots?: Array<{ frameId: string, fileRef: string }>`, optional `writebackReport?: { attemptedAt: string, written: number, skipped: number, failed: Array<{ nodeId, errorCode, errorMessage }> }`, `mode: "single_frame" | "workflow"`
  - `CreateFigmaSessionRequest` adds required `featureName`, required `description`, optional `productId`, required `mode`
- [x] 1.2 New contracts: `ListPageFramesRequest = { pageUrl: string }`, `ListPageFramesResponse = { frames: Array<{ nodeId, name, parentPath, boundingBox }>, detectedDirection: "horizontal" | "vertical" | "grid" }`
- [x] 1.3 Zod parsers + exported TS types
- [x] 1.4 Contract round-trip tests covering all combinations of optional fields
- [x] 1.5 Verification: `npm --workspace @writer/contracts run test`

## 2. Daemon: list-page-frames endpoint + direction detection (WRI-TBD)

- [x] 2.1 New helper `apps/daemon/src/figma-page-frames.ts`:
  - Parse page URL → extract `fileKey` and page `nodeId`
  - Call MCP `get_metadata` for the page
  - Filter direct-child frames + sections
  - Implement direction detection: `xSpan`, `ySpan`, 1.2× threshold, grid fallback (row-major)
  - Return sorted frames + `detectedDirection`
- [x] 2.2 New route in `apps/daemon/src/routes/figma.ts` (or equivalent): `POST /figma/list-page-frames`
- [x] 2.3 Route validates request; passes through `mcp_not_ready` diagnostic when MCP disconnected
- [x] 2.4 Tests in `apps/daemon/src/figma-page-frames.test.ts`:
  - Horizontal layout → direction `horizontal`, frames sorted by x
  - Vertical layout → direction `vertical`, frames sorted by y
  - Grid layout (similar x/y spans) → direction `grid`, row-major order
  - Single frame on page → returns that one frame
  - Invalid URL → 400 error
  - MCP disconnected → `mcp_not_ready` diagnostic
- [x] 2.5 Verification: `npm --workspace @writer/daemon run test -- figma-page-frames`

## 3. Daemon: session intent fields + screenshot capture (WRI-TBD)

- [x] 3.1 `apps/daemon/src/review.ts` session create handler:
  - Validate `featureName` and `description` are non-empty
  - Validate `productId` (if provided) exists in Guidelines tree; reject unknown
  - Persist new fields on session record
- [x] 3.2 Audit completion hook in `review.ts`:
  - For each in-scope frame, call existing `figma-mcp-caller.ts` to invoke MCP `get_screenshot`
  - Persist PNG under `~/.writer/sessions/{sessionId}/screenshots/{frameId}.png`
  - Record `frameScreenshots[]` on session
  - Per-frame screenshot failure is non-fatal — log warning, omit from list, audit stays `completed`
- [x] 3.3 New endpoint (or extend existing): serve screenshot PNGs to the renderer (`GET /sessions/:sessionId/screenshots/:frameId` or similar)
- [x] 3.4 Tests in `apps/daemon/src/review.test.ts`:
  - Reject create with missing `featureName` / empty `description`
  - Reject create with unknown `productId`
  - Accept create without `productId` (optional)
  - Screenshot capture invoked at audit completion; `frameScreenshots` populated
  - Per-frame screenshot failure → audit still `completed`, warning recorded
- [x] 3.5 Verification: `npm --workspace @writer/daemon run test`

## 4. Copywriter Skill: featureName + description injection (WRI-TBD)

- [x] 4.1 Extend `CopywriterSkillInput` in `packages/review-core/src/copywriter-skill.ts` with optional `featureName?: string`, `description?: string` (in addition to the three layer blobs already added by `text-copy-chat-redesign`)
- [x] 4.2 `buildCopywriterPrompt` emits a `Feature context:` section containing feature name + description, placed after writing rules sections and before history/userText
- [x] 4.3 Daemon `review.ts` audit pipeline reads `session.featureName`, `session.description` and passes them to prompt builder
- [x] 4.4 Tests in `packages/review-core/src/copywriter-skill.test.ts`:
  - Feature context section appears with both fields populated
  - Section omitted if both fields absent (no empty heading)
  - Layer ordering: rules → feature context → history → userText
- [x] 4.5 Verification: `npm --workspace @writer/review-core run test`

## 5. Daemon: writeback report + partial-commit + retry (WRI-TBD)

- [x] 5.1 Extend `apps/daemon/src/figma-writeback.ts` (or equivalent):
  - Iterate approved changes
  - For each: if final text equals original Figma text → skip (no write)
  - Otherwise call MCP `use_figma` to set the text
  - Record per-node result in `writebackReport.{written,skipped,failed[]}`
- [x] 5.2 Append (not replace) the latest report onto the session record; most recent attempt drives derived status
- [x] 5.3 Retry path: `POST /figma/writeback { sessionId, changeIds: [failed_ids_only] }` operates only on the specified subset
- [x] 5.4 Tests in `apps/daemon/src/figma-writeback.test.ts`:
  - Full success
  - All-skipped (no changes desired)
  - Partial: K written, M failed; failed entries carry `nodeId`, `errorCode`, `errorMessage`
  - Retry of failed-only subset
- [x] 5.5 Verification: `npm --workspace @writer/daemon run test -- writeback`

## 6. Desktop: FigmaAuditScreen + Workflow tabs (WRI-TBD)

- [x] 6.1 New route `/figma-audit` in `apps/desktop/src/app.tsx` mounting `screens/figma-audit-screen.tsx`
- [x] 6.2 `screens/figma-audit-screen.tsx`: full-screen form with product picker ("(none)" + discovered products), feature name input, description textarea, mode segmented control
- [x] 6.3 Single Frame mode: single URL input; submit creates session + runs audit; navigates to `/audits`
- [x] 6.4 `figma-audit-workflow-tabs.tsx`: segmented control inside Workflow mode with Paste-links and Browse-page tabs
- [x] 6.5 `figma-audit-paste-links.tsx`:
  - Vertical ordered list of step rows (URL input + step badge + reorder handles)
  - "Add step" button appends a row
  - Submit assembles ordered `nodeIds` from valid URLs
- [x] 6.6 `figma-audit-page-browser.tsx`:
  - Page URL input + "Load frames" button calling `POST /figma/list-page-frames`
  - Detected direction banner
  - Ordered list with checkbox (default checked) + frame name + parent-path breadcrumb + drag handle
  - Submit uses checked frames in current display order
- [x] 6.7 Home card `onClick` swap in `apps/desktop/src/screens/home-screen.tsx`: `navigate("/figma-audit")`
- [x] 6.8 Component-level vitest tests for workflow tabs, paste-links, page-browser (pure logic)
- [x] 6.9 Verification: `npm --workspace @writer/desktop run test && npm --workspace @writer/desktop run typecheck`

## 7. Desktop: Audits list screen (WRI-TBD)

- [x] 7.1 New route `/audits` in `app.tsx` mounting `screens/audits-list-screen.tsx`
- [x] 7.2 `screens/audits-list-screen.tsx`:
  - Fetch sessions for active project (newest-first)
  - Render table with columns: feature, product, mode, status, created, Open
  - Status badge derived from session lifecycle + latest `writebackReport`
- [x] 7.3 Open button navigates to `/audits/:sessionId`
- [x] 7.4 Tests for status-badge derivation logic
- [x] 7.5 Verification: typecheck + test

## 8. Desktop: Audit detail screen + rule modal + writeback button (WRI-TBD)

- [x] 8.1 New route `/audits/:sessionId` in `app.tsx` mounting `screens/audit-detail-screen.tsx`
- [x] 8.2 `screens/audit-detail-screen.tsx`:
  - Header: feature, product (or "—"), description, active-layer pill
  - For each frame in session mode order: render `audit-detail-frame-section.tsx`
- [x] 8.3 `audit-detail-frame-section.tsx`:
  - Frame screenshot inline (loads from daemon screenshot endpoint; placeholder on failure)
  - Findings table: # | element type | original | AI suggestion | rule link | user edit (pre-populated with AI suggestion)
- [x] 8.4 `audit-detail-rule-modal.tsx`:
  - Opens on rule-link click
  - Renders rule content from session's `guidelineSnapshot`
  - Source-layer badge (Company Base / Software Writing / Product)
  - Fallback message if `ruleId` missing from snapshot
- [x] 8.5 `audit-writeback-button.tsx`:
  - Primary button "Approve & writeback to Figma"
  - On click: for each row, finalText = userEditValue
  - Sends `POST /review/changes/transition` for each row with `editedText: finalText` and `status: approved`
  - Sends `POST /figma/writeback` for the approved set
  - Handles full success (toast + navigate to /audits), partial (stay on page, show "Retry failed"), full failure (stay on page, show error)
  - Disabled when no findings or daemon disconnected
- [x] 8.6 "Retry failed" button surfaces when latest `writebackReport.failed.length > 0`
- [x] 8.7 Component-level vitest tests for rule modal, writeback button state machine, frame section
- [x] 8.8 Verification: typecheck + test

## 9. Deprecation comment on /review (WRI-TBD)

- [x] 9.1 Add deprecation comment at top of `apps/desktop/src/screens/review-screen.tsx` pointing to `/audits` and `/audits/:sessionId`
- [x] 9.2 No functional change; route remains mounted
- [x] 9.3 Verification: existing `/review` flow still works manually

## 10. End-to-end manual verification

- [x] 10.1 Launch app: `npm run dev`
- [x] 10.2 With ≥1 product: Home → Figma Audit → fill product + feature + description → Single mode → paste frame URL → submit → land on /audits showing In Progress → wait for Done → Open → see screenshot + table + rule modal works → edit one row → leave others → Approve & writeback → land on /audits with `Done · written back`
- [x] 10.3 Without product: same flow with product "(none)" → verify Header pill shows "Auditing against: Company Base + Software Writing"
- [x] 10.4 Workflow mode Paste-links: add 3 step URLs in order → submit → detail page shows 3 sections in order
- [x] 10.5 Workflow mode Browse-page: paste a Figma page URL → "Load frames" → verify detected-direction banner + ordered list → uncheck one frame → drag-reorder another → submit → detail page reflects the user-confirmed order/subset
- [x] 10.6 Auto-skip: leave all rows unedited where AI suggestion matches original → submit writeback → reports `Done · no changes`
- [x] 10.7 Partial commit: trigger a writeback failure (e.g. revoke Figma write permission mid-flow) on a subset → verify `Partial · N written, M failed` on /audits row and Retry failed button
- [x] 10.8 MCP disconnected at audit time: confirm structured `mcp_not_ready` diagnostic surfaces
- [x] 10.9 /review legacy: open `/review` directly → still functional (back-compat)

## 11. Documentation + Linear/OpenSpec sync

- [x] 11.1 Update `PRODUCT.md` to mention structured Figma Audit entry + workflow + audit log
- [x] 11.2 Update `docs/linear-openspec-map.md` with `figma-audit-redesign` → WRI epic + child mapping
- [x] 11.3 Per-task: check off `tasks.md`, commit (one task per commit where possible), update mapped WRI issue per `AGENTS.md` rules
- [x] 11.4 Write `verify.md` and run `/opsx:verify` + `/opsx:archive`

## Verification commands

- `npm run typecheck`
- `npm run test`
- Manual flow per section 10
