## Why

Figma audit today is buried at `/settings?tab=sources` with a single URL paste field. There is no proactive structure (feature name / description / mode), no product picker, no multi-session log, no rule modal, no frame screenshot in the detail view, and no unified Approve-and-writeback flow that surfaces happy-path vs failure on the run row. Workflow mode (multi-frame audit) is supported by the backend (`flow` scope) but has no UI.

This change reshapes the Figma audit surface to match how content designers actually work — they audit one feature at a time, often across multiple sequential frames — and closes the small backend gaps (list-page-frames, screenshot capture) needed to make Browse-page and the visual detail page possible.

## What Changes

- Add **`/figma-audit` full-screen route** — structured entry form: optional product picker, required feature name, required description, mode selector (Single Frame / Workflow).
- Add **Single Frame mode** — one Figma URL field; submit runs the audit.
- Add **Workflow mode with Paste-links + Browse-page segments**:
  - Paste-links: ordered list of step URLs, user adds/reorders steps manually
  - Browse-page: one Figma page URL → daemon enumerates frames via MCP `get_metadata` and returns them auto-ordered by spatial layout (left-to-right or top-to-bottom, auto-detected); user can reorder or unselect; default selection is all frames in detected order
- Add **`POST /figma/list-page-frames`** daemon endpoint backing Browse-page.
- Add **frame screenshot capture at audit completion** — daemon calls MCP `get_screenshot` per in-scope frame and persists onto the session record.
- Add **`/audits` Reviewlog list route** — cross-session table: feature, product, mode, status (In Progress / Done / Failed / Partial), created time, Open button.
- Add **`/audits/:sessionId` detail route** — header (feature, product, original description) + per-frame section (frame screenshot inline + structured table: #, element type, original copy, AI suggestion, rule link → modal, user edit field pre-populated with AI suggestion).
- Add **Rule modal** — click the rule link on a row to open a modal showing the rule content and its source layer (Company Base / Software Writing / Product).
- Add **"Approve & writeback to Figma"** button on detail page — single bulk action; auto-skips nodes whose final user text equals the original Figma text; partial commit; surfaces per-node failures with retry on the audit-runs row.
- Wire **feature name + description** into Copywriter Skill prompt as additional context alongside the three guideline layers.
- Add **optional `productId`** to `FigmaSession` — when present, the three-layer guideline stack is fully injected; when absent, only Company Base + Software Writing layers are injected.
- Re-route Home "Figma Copy" card from `/settings?tab=sources` to `/figma-audit`.

## Capabilities

### New Capabilities

None. This change extends three existing capabilities.

### Modified Capabilities

- `figma-mcp-extraction` — new `POST /figma/list-page-frames` listing capability; new requirement that audit completion captures per-frame screenshots via MCP `get_screenshot`.
- `review-session-storage` — `FigmaSession` adds required `featureName: string`, required `description: string`, optional `productId?: string`, and `frameScreenshots?: Array<{ frameId, fileRef }>`.
- `desktop-shell` — adds `/figma-audit` entry route, `/audits` list route, `/audits/:sessionId` detail route, rule modal component, frame screenshot rendering, Approve & writeback button; modifies Home card routing; deprecates `/review` (kept for back-compat).

## Impact

- **packages/contracts** — `FigmaSession` (or equivalent in `review-session-storage`) gains `featureName`, `description`, `productId?`, `frameScreenshots?`; new request schema for `POST /figma/list-page-frames`; response shape `{ frames: Array<{ nodeId, name, parentPath, boundingBox }>, detectedDirection: "horizontal" | "vertical" }`.
- **apps/daemon** —
  - New route `apps/daemon/src/routes/figma.ts` (or extend existing) for `POST /figma/list-page-frames`
  - New helper `apps/daemon/src/figma-page-frames.ts` for MCP `get_metadata` + layout direction detection
  - Audit completion hook captures screenshots via existing `figma-mcp-caller.ts` (`get_screenshot`)
  - `apps/daemon/src/review.ts` accepts and persists `featureName`, `description`, `productId?` on session creation; passes them to prompt builder
  - Writeback flow records per-node failure with diagnostic messages; surface on session record
- **packages/review-core** — Copywriter Skill prompt builder accepts `featureName?` and `description?` alongside the three guideline-layer blobs already added by `text-copy-chat-redesign`
- **apps/desktop** —
  - New `screens/figma-audit-screen.tsx` (entry form + mode segmented control)
  - New `screens/audits-list-screen.tsx` (Reviewlog table)
  - New `screens/audit-detail-screen.tsx` (per-frame sections + table + writeback button)
  - New `figma-audit-workflow-tabs.tsx` (Paste-links / Browse-page segmented control)
  - New `figma-audit-page-browser.tsx` (Browse-page list with reorder + multi-select)
  - New `figma-audit-paste-links.tsx` (ordered step URL inputs)
  - New `audit-detail-rule-modal.tsx` (rule modal)
  - New `audit-detail-frame-section.tsx` (screenshot + table per frame)
  - New `audit-writeback-button.tsx` (bulk approve + writeback with partial-commit feedback)
  - Route additions in `app.tsx`; Home card `onClick` swap in `screens/home-screen.tsx`
  - `paste-text-chat-panel.tsx` / Settings Sources tab not touched in this change
- **`~/.writer/`** — no schema change; session record extended in place
- **PRODUCT.md** — note structured Figma Audit entry + multi-frame workflow + audit log
- **docs/linear-openspec-map.md** — add `figma-audit-redesign` → new WRI epic mapping (numbers assigned at proposal review)

## Non-Goals (v1)

- Image / screenshot thumbnails in the Browse-page frame list (text-only list ships in v1)
- Explicit per-row "Skip" toggle (auto-skip on user-text == original handles the case)
- Audit-run cancellation UI (kill mid-run)
- Per-row inline writeback (batch-only in v1)
- Workflow-mode cross-frame consistency checks (e.g. same label used differently across steps)
- Multi-user collaboration / inline comments on findings
- Removing `/review` route (stays mounted as deprecated for back-compat)
- All-or-nothing writeback rollback (partial commit is the contract)
- Codex / Claude adapter registration (still cursor-agent + devin only)
