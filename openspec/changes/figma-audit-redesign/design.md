# Design · Figma Audit Redesign

## Context

Writer's Figma audit pipeline is functionally complete end-to-end: MCP extraction, guideline-grounded LLM audit, review queue with edit-before-approve, permission-gated writeback, multi-format export. The remaining work is product-shaped, not infrastructure-shaped:

- Entry is a single URL field in a Settings tab; users have no place to express intent (feature name, description, mode).
- No multi-session log surface; `/review` only shows the active session.
- Detail UI is a queue panel, not a per-frame layout with the structured columns and rule modal users expect.
- Workflow mode (multi-frame audit) is backend-ready but has no UI.
- Frame screenshots are never shown alongside findings.
- Writeback success/failure isn't surfaced on a unified audit-run row.

Stakeholders: content designers and PMs auditing UX copy across single frames and multi-step product flows.

Architecture invariants (unchanged):

- Renderer never invokes Figma MCP or CLIs directly
- Daemon validates I/O via `@writer/contracts`
- Active LLM adapter from `platform-store.json`
- Writeback requires approved change IDs through existing permission gates

## Goals

1. Replace the Settings-embedded URL paste with a full-screen, structured `/figma-audit` entry — product (optional), feature name (required), description (required), Single/Workflow mode.
2. Ship Workflow mode with both Paste-links and Browse-page input UX, with auto-detected frame ordering from spatial layout for Browse-page.
3. Provide a cross-session `/audits` Reviewlog list with status badges (In Progress / Done / Failed / Partial).
4. Provide a per-frame `/audits/:sessionId` detail page with frame screenshot + structured table + rule modal + pre-populated user edit field.
5. Unify Approve-and-writeback into a single button with partial-commit semantics, auto-skip-when-unchanged, and clear failure feedback that lands on the audit-runs row.

## Non-Goals

- Image attachments in Browse-page list (text only, v2 for thumbnails)
- Explicit per-row Skip UI
- Per-row inline writeback
- Workflow cross-frame consistency checks
- Daemon `phase` events (front-end derives state)
- Removing `/review` route in this change
- Authoring UI for Guidelines (editor remains the source of truth)

## Decisions

### D1: New `/figma-audit`, `/audits`, `/audits/:sessionId` routes

**Choice:** Three new top-level routes in `apps/desktop/src/app.tsx`:

- `/figma-audit` → `screens/figma-audit-screen.tsx` (entry form, no Settings chrome)
- `/audits` → `screens/audits-list-screen.tsx` (Reviewlog table, no Settings chrome)
- `/audits/:sessionId` → `screens/audit-detail-screen.tsx` (per-frame detail)

Home "Figma Copy" card `onClick` re-routes to `/figma-audit`. The existing `/review` route stays mounted as deprecated back-compat per the same pattern used for the Settings-embedded paste-text Card in `text-copy-chat-redesign`.

**Rationale:** Settings-tab embedding is the same trap Text Copy fell into. Full-screen dedicated routes match user expectations from comparable tools.

### D2: Product is optional on Figma audit (differs from Text Copy)

**Choice:** `FigmaSession.productId?: string` (optional). Entry form's product picker has a "(none)" choice in addition to the discovered products.

Prompt assembly:

- `productId` present → inject Company Base + Software Writing + Product-specific (three layers)
- `productId` absent → inject Company Base + Software Writing (two layers)

The `text-copy-chat-redesign` change already extends `CopywriterSkillInput` with optional `companyBase`, `softwareWriting`, `productGuideline`. Omitting `productGuideline` produces exactly the two-layer behavior wanted here, no further changes to prompt assembly needed beyond passing `undefined`.

**Rationale:** Users explicitly want to audit Figma work even when no product guideline exists yet (e.g. exploratory designs, new features without a product folder). Required-product would block this.

### D3: Workflow mode — two input methods

**Choice:** A segmented control inside Workflow mode with two tabs:

#### D3a: Paste-links tab

- Vertical ordered list of step rows
- Each row: a URL input + a step number badge + reorder handles (up/down or drag)
- "Add step" button appends a new empty row
- Submit validates each URL parses to a Figma frame/node ID

#### D3b: Browse-page tab

- One Figma **page** URL field
- "Load frames" button → daemon `POST /figma/list-page-frames { pageUrl }` → returns frames + detected direction
- Renderer shows:
  - Banner: "Detected flow direction: ← left to right" (or ↓ top to bottom)
  - Ordered list of frames, each row: checkbox (default checked) + frame name + parent-path breadcrumb + drag handle
  - User can uncheck frames or drag-reorder
- Submit takes the checked frames in current display order

#### D3c: Daemon endpoint `POST /figma/list-page-frames`

Request: `{ pageUrl: string }`

Behavior:

1. Parse `pageUrl` to extract `fileKey` + page `nodeId` (reject if URL is not a Figma `/design/` URL)
2. Call MCP `get_metadata` scoped to that page node
3. Filter metadata for direct-child frames (and optionally sections) of the page
4. For each frame, extract `{ nodeId, name, parentPath, boundingBox: { x, y, width, height } }`
5. Compute `detectedDirection`:
   - `xSpan = max(x + width) - min(x)` across all frames
   - `ySpan = max(y + height) - min(y)` across all frames
   - `xSpan > ySpan * 1.2` → `horizontal`
   - `ySpan > xSpan * 1.2` → `vertical`
   - Else → `grid` (fallback to row-major ordering: bucket by y-rounded-to-row-height, then x ascending within each row)
6. Sort frames by detected direction and return

Response: `{ frames: Array<{ nodeId, name, parentPath, boundingBox }>, detectedDirection: "horizontal" | "vertical" | "grid" }`

**Rationale for both A and B:** Paste-links is the fast path for users who already know the 3 frames they care about. Browse-page eliminates the manual URL-copying chore when the user is auditing all frames on a flow page. The 1.2x bias factor for direction detection avoids flipping on near-square layouts.

### D4: Auto-skip writeback when user text equals original

**Choice:** At writeback time, for each row in the user edit table, compare the final user-supplied text against the Figma original text. If exactly equal, skip the node — no MCP write, no error. If different, write the user-supplied text via `use_figma`.

The writeback report tallies `{ written: N, skipped: M, failed: K }` and surfaces it on the audit-runs row.

**Rationale:** No extra UI element, predictable behavior, matches the user's stated semantic ("unchanged means accept; changed means user disagrees"; equality with original means "user reverted to original" which is effectively "skip").

**Trade-off:** Users cannot explicitly mark a row as "reviewed but no change desired" vs "I haven't looked at this yet." For v1 we treat these the same. If telemetry shows the distinction matters, revisit in v2 with an explicit Skip column.

### D5: Partial commit on writeback failure

**Choice:** Writeback iterates nodes; each node-write is independent. Successful writes commit. Failed writes are recorded onto the session with their `nodeId`, error code, and message. Reviewlog row shows status:

| Outcome | Status badge |
|---|---|
| All writes succeeded | `Done · written back` |
| All skipped (no changes) | `Done · no changes` |
| Some failed, some succeeded | `Partial · N written, M failed` |
| All failed | `Failed · 0 written, N failed` |

A "Retry failed" button on the detail page re-attempts only the failed-node subset.

**Rationale:** Figma offers no cross-node transaction primitive. Simulating rollback (re-writing failed nodes back to original) is itself a write that can fail, recursively. Honest semantics beat misleading atomicity.

### D6: New `/audits` list + `/audits/:sessionId` detail; `/review` deprecated

**Choice:** Two new screens replace the active-session-only `/review` view:

- `/audits` lists all sessions belonging to the current project (regardless of status) with columns: feature name, product (or "—"), mode (Single / Workflow), status badge, created time, Open button.
- `/audits/:sessionId` shows the session detail.

`/review` remains mounted; its existing entry points (export menu, Run audit again button) keep working. A deprecation comment in `review-screen.tsx` points to the new screens; full removal scheduled for a follow-up change after analytics confirm no entry.

**Rationale:** Cross-session visibility is the primary user request; building it as net-new screens is cleaner than retrofitting `/review`.

### D7: Frame screenshots captured at audit completion

**Choice:** When `audit.run` reaches terminal completed status, daemon iterates the in-scope frames and calls MCP `get_screenshot` for each. The resulting images are persisted onto the session record as `frameScreenshots: Array<{ frameId, fileRef }>` where `fileRef` is a local path under `~/.writer/sessions/:sessionId/screenshots/` (PNG).

Detail page loads images by reading those local files via the daemon (`GET /sessions/:id/screenshots/:frameId` or similar), so the renderer never touches MCP.

**Rationale:** Audits are already 30–60s; adding 1–3s per frame for screenshots is acceptable. Persisting at completion means the detail page is instant on every reopen, and screenshots remain available even after MCP disconnects.

**Failure mode:** If a screenshot call fails for a specific frame, that frame's section in the detail page shows a placeholder ("Screenshot unavailable") but the textual audit results still render. The audit run itself does not fail because of a screenshot miss.

## Data flow

```text
Home Figma Copy card
  → navigate("/figma-audit")
FigmaAuditScreen mounts
  → getGuidelinesTree()  (for product picker; "(none)" + discovered products)
  → user fills: productId? + featureName + description + mode + URL(s)/Page URL
User submits in Single mode
  → POST /review/sessions
      { source: { kind: "figma", scope: "frame", url },
        featureName, description, productId? }
  → POST /review/audit/run { sessionId }
  → renderer navigates to /audits and the new row appears "In Progress"
User submits in Workflow mode (Paste-links)
  → POST /review/sessions
      { source: { kind: "figma", scope: "flow", nodeIds: [...] },
        featureName, description, productId? }
  → POST /review/audit/run { sessionId }
User submits in Workflow mode (Browse-page)
  → POST /figma/list-page-frames { pageUrl }
  → Daemon: parse URL → MCP get_metadata → compute direction → sort
  → Renderer: present ordered list; user adjusts; submits
  → POST /review/sessions {scope: "flow", nodeIds: [selected, in user-confirmed order], ...}
  → POST /review/audit/run { sessionId }
Audit pipeline
  → Existing extraction (figma-mcp-extraction)
  → Existing prompt build, NOW with featureName + description + 2-or-3 guideline layers
  → Findings persisted to session
  → NEW: For each frame in scope, call MCP get_screenshot
        → persist PNG under ~/.writer/sessions/:id/screenshots/
        → record frameScreenshots[] on session
  → Session status → "completed"
Audits list (/audits)
  → GET /review/sessions?project={projectId}
  → render row per session with status badge derived from session + writebackReport (if any)
Audit detail (/audits/:sessionId)
  → GET /review/sessions/:id  (includes findings + frameScreenshots + writebackReport)
  → render header (feature, product, description)
  → for each frame: section with screenshot image + table
      columns: # | element type | original | AI suggestion | rule link | user edit (pre-populated with AI suggestion)
  → user clicks rule link → modal queries session guidelineSnapshot for ruleId → renders rule content + source-layer badge
  → user edits user-edit cells freely
  → user clicks "Approve & writeback to Figma"
      → For each row: finalText = userEditCell || aiSuggestion
      → For each row: if finalText == originalText → skip
      → For each remaining row: POST /review/changes/transition { changeId, status: "approved", editedText: finalText }
      → POST /figma/writeback { sessionId, changeIds: [...] }
          Daemon iterates approved changes:
            - call MCP use_figma to set text on the node
            - record success or per-node error onto a writebackReport
      → Response: { writebackReport: { written, skipped, failed: [{ nodeId, error }] } }
  → Renderer: update detail page with results; on full success, navigate back to /audits
"Retry failed" (when partial)
  → POST /figma/writeback { sessionId, changeIds: [failed ids only] }
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Auto-detect direction wrong on irregular layouts | Show detected direction in UI; user can reorder freely; `grid` fallback for ambiguous cases |
| Screenshot capture inflates audit time | Capture in parallel where possible; each frame failure is independent and non-fatal |
| Session record bloat from embedded images | Store as files under `~/.writer/sessions/:id/screenshots/`, not as base64 in session JSON; reference by path |
| Partial writeback confuses users | Status badge `Partial · N written, M failed` is explicit; "Retry failed" surfaces the recovery path; per-row error tooltip on detail page |
| Rule modal shows stale rules if guideline edited mid-conversation | Modal reads from session's `guidelineSnapshot`, not live `.md` files — same snapshot semantic established in `text-copy-chat-redesign` |
| Browse-page response slow for large pages | MCP `get_metadata` already paginates; daemon returns once metadata resolves; UI shows loading state with timeout |
| Workflow with 0 selected frames after user unchecks all | Submit button disabled; inline message |
| "(none)" product → no Product layer → users assume audit is weaker | UI shows pill in detail header: "Auditing against: Company Base + Software Writing" so the layer set is transparent |

## Migration Plan

1. Ship contracts changes first (`FigmaSession` fields: `featureName`, `description`, `productId?`, `frameScreenshots?`). Existing sessions back-fill `featureName: "Legacy session"`, `description: ""` on read (or are excluded from the new `/audits` list — decide during tasks).
2. Ship daemon changes (`POST /figma/list-page-frames`, screenshot capture hook, session field persistence, writeback report).
3. Ship Copywriter Skill `featureName` / `description` injection (small extension to existing prompt assembly from `text-copy-chat-redesign`).
4. Ship desktop screens (`/figma-audit`, `/audits`, `/audits/:sessionId`) + supporting components.
5. Switch Home card route.
6. Mark `/review` deprecated in source.

Rollback: revert Home card route; new routes are additive and harmless if unrouted. Contracts changes (new required fields `featureName`, `description`) are the boundary commit — rollback would need contract relaxation.

## Open Questions

- How should `/audits` filter / sort default? Newest-first; project-scoped. Refine in tasks.
- Should the rule modal show only the matched rule, or the rule plus its surface filter context? v1: just the rule. v2: add context.
- Pagination on `/audits` if a project has hundreds of sessions? v1 ships unpaginated; if observed list is heavy, add cursor pagination in v2.
- Should writeback report be surfaced as a Linear-style activity feed entry? Out of scope for v1.
