# Brainstorm: Separate Text and Figma Audit Workflows

## Background

Writer's redesigned home screen now presents two user intents: `Figma Audit`
and `Text`. The current implementation does not yet honor that distinction:
both cards route into `Settings` tabs, `Sources` mixes Figma intake with the
paste-text chatbot, and `Review` contains the audit-result workflow.

Existing product capabilities remain valuable:

- Paste-text chat already supports LLM rewrites, message history, pending
  output, copy actions, and CSV/XLSX attachment processing.
- Figma review already supports Figma session creation, review queue state,
  approvals, export, and permission-gated writeback.
- Guidelines/product work has established global company and software writing
  configuration plus optional product-specific context.

The intended change is therefore a workflow and responsibility reorganization,
not a replacement of the existing daemon safety model or rewrite/audit engines.

## Decision Chain

### Q1: What top-level user workflows exist?

**Decision:** The home screen exposes exactly two work entrances:
`Figma Audit` and `Text`. Each opens a dedicated page with a Back button to
return home.

`Settings` stops being a container for work execution. It no longer exposes
`Review` or `Sources`; it remains for configuration concerns such as
Guidelines and Agents.

### Q2: How focused is the Text workflow?

**Decision:** Text is a rewrite-only chatbot, not a general-purpose assistant
and not a Figma audit source. Users can paste text directly and can retain the
existing CSV/XLSX attachment path for bulk or row-based text rewrites.
Attachments stay within the conversation and never create Figma Audit Log
entries.

### Q3: Does Text require a product selection?

**Decision:** No. Company-based and software-writing rules are configured
globally and apply to every Text rewrite. Selecting a specific Product is
optional; when selected, its product background, glossary, and writing rules
augment the rewrite context. If a selected Product cannot be loaded, the
operation fails visibly rather than silently dropping its context.

### Q4: What is the responsibility of the Figma Audit entrance page?

**Decision:** The Figma Audit page creates a run from a Product selection and
a Figma URL and displays an Audit Log. Each submitted audit run is represented
as one Batch row, including Product, target-object summary, Batch identifier,
Label, status, and timestamps.

### Q5: Where are findings, approvals, and writeback handled?

**Decision:** Selecting a Batch row opens a dedicated Audit Detail page.
Detail owns findings, rewrite suggestions, approvals, export, and explicitly
approved Figma writeback. The Audit Log page does not grow into an embedded
review workspace.

### Q6: Which current models should be reused?

**Decision:** Reuse Text conversation APIs and attachment orchestration for
Text. Reuse Figma session, review queue, approval, and writeback flows for
Audit Detail. Extend or adapt persisted Figma session/run metadata for Audit
Log needs before introducing a redundant batch model.

## Approaches Considered

| Approach | Advantages | Problems | Decision |
| --- | --- | --- | --- |
| Dedicated workflow routes using existing engines | Product structure matches the two home intents; preserves implemented capabilities and safety controls | Requires routing, screen-state, and Audit Log metadata work | Selected |
| Move existing panels into two pages with minimal restructuring | Small initial UI diff | Continues to mix Figma creation and review-detail concerns; does not deliver the requested logic simplification | Rejected |
| Rebuild conversations and audit runs as new backend models | Clean model in isolation | Duplicates working APIs and increases migration/safety risk without user benefit | Rejected |

## Validated Design

### Information Architecture

- Home routes to `/text` and `/figma-audit`.
- `/text` is a standalone rewrite chatbot page with a home Back action.
- `/figma-audit` contains Figma URL intake plus the batch-level Audit Log.
- `/figma-audit/:batchId` is the detailed audit review and approved-writeback
  workspace, with navigation back to the Audit Log.
- `/settings` provides Guidelines and Agents configuration only.

### Text Data Flow

1. A user opens Text and may select a Product or leave it unset.
2. A user pastes text or attaches an existing supported text/spreadsheet input.
3. The daemon constructs rewrite context with mandatory global company and
   software-writing rules and optional product context.
4. The existing conversation/LLM flow returns rewrite output, message status,
   copy support, and explicit errors.
5. No Text action produces an Audit Batch or Figma writeback action.

### Figma Audit Data Flow

1. A user opens Figma Audit, selects a Product, pastes a Figma URL, and
   starts an audit.
2. The app records one batch-level run entry with display metadata and
   lifecycle status (`running`, `completed`, or `failed` at minimum).
3. The Audit Log presents one row per run and preserves failed runs if a
   batch was created.
4. Selecting a row loads Audit Detail by stable batch/session identity.
5. Detail reuses the existing finding, approval, export, and permission-gated
   writeback path.

### Error and Safety Boundaries

- Text must not silently run without mandatory global writing-rule context.
- Text remains usable without Product context; a selected but unreadable
  Product is a visible error.
- Invalid URLs, missing Product selection, MCP connection failures, and audit
  failures appear on the Audit creation surface; created failed runs remain
  traceable in the Log.
- Figma writeback remains daemon-controlled and requires approved change IDs.

### Migration and Non-Goals

- Replace home links to Settings tabs with dedicated workflow routes.
- Move Text UI behavior out of `Sources`; move audit creation and audit-detail
  behavior out of `Sources` and `Review`.
- Update old empty-state copy, internal links, and user-facing docs that refer
  to `Sources` or `Review` as work entrances.
- Do not add conversation history management for Text in this slice.
- Do not place Text attachment activity into Audit Log.
- Do not display one Audit Log row per Figma object or finding.
- Do not redesign approval or permission enforcement.

## Acceptance Criteria

- Home exposes working `Figma Audit` and `Text` navigation paths, each with
  Back navigation to home.
- Settings no longer exposes `Review` or `Sources`.
- Text supports rewrite with mandatory global rules, optional Product context,
  and the existing supported attachment flow.
- Figma Audit creates a batch-level run from Product plus URL and displays one
  log row per run with Product, object, Batch, Label, status, and time data.
- Selecting a Log row opens Audit Detail for existing review, approval, export,
  and approved-writeback functions.
- `npm run typecheck` and `npm run test` pass, supplemented by manual checks of
  both user workflows.

## Approval

The user confirmed the dedicated-route approach, optional Product behavior for
Text, retained Text attachments, one-row-per-Batch Audit Log, separate Audit
Detail page, and the error/migration/acceptance boundaries in this
brainstorming session on 2026-05-25.
