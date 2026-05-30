## Why

The home screen now signals two simple jobs, but both cards still route users
into `Settings`, where `Sources` mixes Figma intake with Text rewrite and
`Review` separately holds audit results. Designers and content designers need
each home entrance to open one focused workflow: quick text rewrite or
traceable Figma audit. This change aligns navigation and audit history with
that mental model while retaining the already implemented rewrite, approval,
and writeback safety paths.

## What Changes

**Workflow entrances and settings**
- From: Home cards open `Review` and `Sources` tabs inside Settings.
- To: Home opens standalone `Text` and `Figma Audit` workflow pages; Settings
  contains configuration surfaces only and removes `Review` and `Sources`.
- Reason: Work execution must not be hidden inside configuration navigation.
- Impact: User-visible navigation change; old screen links and empty-state
  guidance must be updated.

**Text rewrite workflow**
- From: The paste-text chatbot is embedded beside Figma intake in `Sources`,
  and its product/guideline relationship is not expressed by the new entrance.
- To: A dedicated Text page provides paste and existing CSV/XLSX rewrite
  input, always applies company-based and software-writing rules, and lets the
  user optionally add specific Product context.
- Reason: Text is a focused rewrite tool while still supporting established
  bulk rewrite input.
- Impact: Builds on the implemented `paste-text-chat-rewrite` conversation and
  attachment path; Text activity is explicitly excluded from Figma audit
  history.

**Figma audit log and detail navigation**
- From: Figma intake and review results are separated across `Sources` and
  `Review`, with no batch-level entry page for prior runs.
- To: A dedicated Figma Audit page creates runs and presents one Audit Log row
  per Batch; selecting a row opens a detail route for findings, approval,
  export, and approved writeback.
- Reason: The list page remains scannable while detail preserves the existing
  human gate and safety boundary.
- Impact: Requires persisted run metadata/list retrieval and desktop detail
  routing; approved Figma mutation remains daemon-enforced.

## Capabilities

### New Capabilities

- `text-rewrite-workflow`: Dedicated Text entrance, mandatory global
  writing-rule context, optional Product context, supported attachment
  rewrites, and isolation from Figma Audit Log.

### Modified Capabilities

- `desktop-shell`: Replace Settings-hosted work tabs with dedicated home,
  Text, Figma Audit Log, and Audit Detail routes.
- `review-session-storage`: Represent persisted Figma audit sessions as
  batch-level history entries with listable display metadata and lifecycle
  status.

## Impact

- **Desktop UI:** `apps/desktop/src/app.tsx`, home/settings screens, current
  sources/review composition, workspace state, and related navigation copy.
- **Shared contracts and persistence:** `packages/contracts` and
  `packages/storage` need Audit Log display/list types and any additional
  persisted batch metadata.
- **Daemon API:** `apps/daemon` needs list/read support for Figma audit batches
  and Text rewrite context assembly using the global writing layers plus an
  optional Product layer.
- **Existing capabilities:** Reuses the implemented paste-text conversation,
  attachment, review queue, export, and writeback mechanisms. It respects the
  local platform architecture and does not move privileged work into the
  renderer.
- **Reference product scope:** Refines the two workflows described in
  `docs/superpowers/specs/2026-05-22-figma-ux-copy-review-design.md`; it does
  not reopen the platform boundaries established by
  `docs/architecture/local-platform-architecture.md`.

## Non-Goals

- Text conversation history browsing or lifecycle management outside the
  active chatbot.
- Adding Text rewrites or Text attachments to the Figma Audit Log.
- Splitting an Audit Batch into one table row per Figma object or finding.
- Completing audit review/writeback inline on the Audit Log page.
- Replacing existing approval states, permission gates, or Figma MCP
  writeback enforcement.
