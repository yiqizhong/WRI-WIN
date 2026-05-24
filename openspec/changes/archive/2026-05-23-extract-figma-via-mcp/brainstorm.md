# Brainstorm · extract-figma-via-mcp

Captured 2026-05-23 and revised 2026-05-24 after the product scope was clarified.

## Product Intent

The desired workflow is deliberately narrow:

```text
Paste one selected Figma Frame URL
  -> extract every text node in that Frame
  -> analyze and propose rewrites
  -> user approves or edits proposals
  -> user explicitly applies approved copy back to Figma
```

The current app violates this expectation in two places: extraction returns hardcoded copy, and `/figma/writeback` reports applied results without mutating Figma.

## Decisions

### D1. Scope is Frame-only for v1

- Accept only Figma `/design/` URLs carrying a concrete `node-id` for the selected Frame.
- Reject file-wide URLs, flow selection, Make, FigJam, and Slides inputs in this change.
- Reason: the core user job is reviewing a selected Frame. Broad scope handling adds traversal and UX cases before the basic loop is trustworthy.

### D2. Read real text with read-only MCP calls

- Use `get_metadata` on the selected Frame to discover hierarchy and text node IDs.
- Use `get_design_context` for discovered text nodes to obtain actual displayed copy and relevant style hints.
- Persist each extracted text node's original Figma node ID; that identity drives later writeback.
- Never synthesize text, and never treat a layer name as copy when a node read fails.

### D3. Approval is not mutation

- Clicking Approve or saving an edit only creates a writeback-eligible review change.
- Mutation occurs only when the user explicitly clicks `Apply approved to Figma`.
- Reason: the user can review a batch without external side effects and confirm once before a destructive operation.

### D4. Real writeback uses Figma MCP `use_figma`

- Replace the dry-run `/figma/writeback` behavior with a daemon-owned MCP call to `use_figma`.
- For each eligible change, the generated operation targets the original text node ID and assigns the final approved/edited text.
- The daemon enforces both requirements before invoking MCP: an eligible change status and approved write permission.
- If a node's current text no longer equals the extracted original text, fail that node as a conflict instead of overwriting newer Figma changes.

### D5. Partial failure is visible and retryable

- Extraction skips an individual failed text read and emits a warning; valid sibling text nodes remain reviewable.
- Writeback records `applied` or `failed` per node; successful writes remain applied, and failed nodes remain available for retry.
- MCP-disconnected or unsupported-source cases fail loudly with a recovery message and no stub fallback.

### D6. Defer non-essential expansion

- No full MCP tool browser, screenshot rendering, annotations/comments, streaming progress, or cache in this change.
- Performance optimization follows measured Frame extraction behavior, not speculation.

## Dependencies

| Dependency | State | Use |
| --- | --- | --- |
| Figma MCP OAuth/client lifecycle | Ready | Existing daemon client and Agents/MCP connection UX |
| MCP `get_metadata` / `get_design_context` | Ready and mockable | Frame read fixture tests plus live smoke |
| MCP `use_figma` | Ready and mockable | Permission-gated text writeback |
| Approval state machine | Ready | Existing `approved` / `edited` eligibility |
| Permission gate and audit log | Ready but writeback integration incomplete | Must wrap real mutation |

## Acceptance

- `npm run typecheck` and `npm run test` pass after any pre-existing baseline failure is addressed or explicitly waived.
- Strict OpenSpec validation passes.
- Connected manual smoke: a selected Frame produces actual Figma text in the review queue.
- Approval smoke: no Figma mutation occurs when a change is merely approved.
- Apply smoke: explicit apply modifies approved/edited original nodes in Figma and reports result.
- Failure smoke: disconnected MCP and write conflicts show actionable diagnostics without fake output or silent overwrite.

## Promotion State

All promotion criteria hold: scope is locked to Frame review/writeback, design forks are resolved, dependencies are mapped, acceptance criteria are concrete, and the user explicitly approved this upgraded closed-loop scope on 2026-05-24.
