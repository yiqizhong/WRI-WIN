## Context

The desktop renderer currently exposes only `/` and `/settings`. Home cards
navigate to Settings query tabs; `SourcesScreen` combines the Figma URL form
with `PasteTextChatPanel`, while `ReviewScreen` renders queue, export, and
changelog operations for the active session. This arrangement conflicts with
the simplified two-entrance home screen.

The services already contain substantial behavior to preserve:

- `apps/daemon/src/paste-text.ts` and its desktop client implement text
  conversations, LLM messaging, pending results, and attachments.
- `apps/daemon/src/review.ts` and `apps/daemon/src/review-queue.ts` implement
  Figma sessions, queues, transitions, exports, and writeback flow.
- `packages/storage/src/store.ts` persists sessions and conversations.
- The Guidelines runtime provides company, software-writing, and optional
  Product layers that should govern rewrite context.

Stakeholders are designers, PMs, and content designers who need a short Text
path and a traceable Figma Audit path. The renderer remains a UI/client only:
it must not execute LLMs, load privileged files, call MCP directly, or decide
write permissions. The daemon remains the owner of validation, context
assembly, extraction, and approved writeback.

## Goals / Non-Goals

**Goals:**

- Give `Figma Audit` and `Text` independent, back-navigable workflow routes.
- Make Settings configuration-only by removing work-execution tabs.
- Preserve existing text conversation and attachment behavior while applying
  mandatory global writing layers and optional Product context.
- Expose Figma audit history as one row per run/Batch and route each row to an
  independent detail workspace.
- Reuse existing review queue, approval, export, and writeback enforcement.

**Non-Goals:**

- Building Text conversation history navigation.
- Logging text rewrites as Figma audits.
- Representing findings or frames as Audit Log rows.
- Redesigning LLM adapters, MCP integration, approval states, or Figma
  writeback permission policy.
- Adding new tool or MCP integrations.

## Decisions

### D1: Dedicated renderer routes replace Settings workflow tabs

- **Choice:** Add standalone routes for `/text`, `/figma-audit`, and
  `/figma-audit/:batchId`; retain `/settings` only for Guidelines and Agents.
- **Rationale:** Routes make the user's two home intents first-class and allow
  Audit Log and Audit Detail to have distinct responsibilities.
- **Alternative considered:** Wrap existing `Sources` and `Review` panels in
  new pages with minimal movement. Rejected because the entry page would still
  mix job creation and detail review.

### D2: Recompose existing UI capabilities rather than replace them

- **Choice:** Build Text around `PasteTextChatPanel` behavior, build Audit
  creation/log around the existing Figma session flow, and build Audit Detail
  around current review queue/changelog/export/writeback components.
- **Rationale:** The current capabilities already cover high-risk operations
  and preserve daemon enforcement. This change concerns product boundaries and
  query/list metadata, not a new execution engine.
- **Alternative considered:** Create new audit and conversation models. Rejected
  because it would duplicate persisted work and expand migration risk.

### D3: Text rewrite context is global by default and Product-augmented

- **Choice:** Text requests always receive company-based and
  software-writing context assembled in the daemon. The request/conversation
  may carry an optional `productId`; when present the daemon adds that
  Product's context and rejects unreadable/invalid selected context visibly.
- **Rationale:** The user may run quick rewrites without picking a Product,
  while baseline organizational writing guidance remains consistent.
- **Alternative considered:** Require Product selection for every rewrite.
  Rejected because it creates friction and contradicts the confirmed optional
  behavior.
- **Affected paths:** `packages/contracts/src/paste-text.ts`,
  `apps/daemon/src/paste-text.ts`, guideline context helpers under
  `apps/daemon/src/guidelines/` or `packages/review-core/src/`, and
  `apps/desktop/src/paste-text-chat-panel.tsx`.

### D4: Audit Log is a projection of persisted Figma sessions/runs

- **Choice:** Treat a Figma audit run/session as the stable Batch identity and
  expose a listable Audit Log projection containing `batchId`/session identity,
  Product, target summary, label, status, and timestamps. Extend persisted
  session metadata only where required for display; do not introduce a second
  audit ownership model.
- **Rationale:** Findings, changes, changelog, and exports already key off
  `sessionId`, so the detail route can reuse that stable identity.
- **Alternative considered:** Persist a separate log record that points at the
  session. Rejected unless implementation investigation proves session
  metadata cannot support the required fields without breaking compatibility.
- **Affected paths:** `packages/contracts/src/review-session.ts`,
  `packages/storage/src/store.ts`, `apps/daemon/src/review.ts`,
  `apps/daemon/src/routes/review.ts`, and
  `apps/desktop/src/daemon-client.ts`.

### D5: Audit Detail retains the privileged-action safety boundary

- **Choice:** The desktop detail route loads existing queue/changelog/export
  operations and sends approved writeback requests through the daemon exactly
  as existing review behavior does.
- **Rationale:** Navigation must not weaken the mandatory human gate.
- **Permission/risk class:** No new tool or MCP capability is introduced.
  Existing Figma writeback remains a write/destructive operation requiring
  approved change IDs and daemon permission checks; audit listing and detail
  loading are read-only operations.
- **Affected paths:** `apps/desktop/src/screens/review-screen.tsx`,
  `apps/desktop/src/review-queue-panel.tsx`, and existing daemon review routes.

## Risks / Trade-offs

- **[Risk] In-flight Text artifacts and this workflow change describe adjacent
  UI behavior.** -> Mitigation: Treat `paste-text-chat-rewrite` as the
  underlying implemented conversation/attachment capability and specify here
  only dedicated entry routing and guideline/Product context additions.
- **[Risk] Existing sessions lack a human-readable Label or sufficient target
  summary for the Log.** -> Mitigation: Add backward-compatible optional
  metadata and compute safe display fallbacks for previously persisted Figma
  sessions.
- **[Risk] A single workspace-wide selected Product unintentionally makes
  Text's optional selection required or affects Figma Detail.** -> Mitigation:
  separate Text input selection state from required Audit creation state and
  validate both in component and daemon tests.
- **[Risk] Removing Settings tabs leaves stale navigation and recovery links.**
  -> Mitigation: inventory links and empty states in desktop code and update
  tests/manual smoke steps for direct routing.
- **[Trade-off] Keep CSV/XLSX attachment behavior on the Text page.** ->
  Accepted because attachments are another rewrite input, while their outputs
  remain isolated from audit/history semantics.

## Migration Plan

1. Extend contracts and persistence/API projections for Audit Log and optional
   Text Product context while accepting existing stored sessions and
   conversations.
2. Add daemon behavior for listing Figma audit batches and injecting mandatory
   global plus optional Product context into Text rewrites.
3. Add the dedicated desktop routes and recompose existing panels into Text,
   Audit Log, and Audit Detail screens.
4. Remove `Review` and `Sources` Settings tabs and update all affected internal
   navigation/copy and user-facing documentation.
5. Verify with contract/daemon/desktop tests, `npm run typecheck`,
   `npm run test`, and manual flows for Text with/without Product and Figma
   Batch-to-Detail navigation/writeback safety.

Rollback is UI-compatible: restore old Settings links and panel composition
while leaving backward-compatible metadata fields unused. No writeback or
permission-gate migration is part of this change.

## Open Questions

None blocking implementation. During implementation, use the existing session
identifier as `batchId` unless tests reveal that a distinct user-visible label
requires an additional optional display field; that choice remains within the
confirmed one-row-per-run behavior.
