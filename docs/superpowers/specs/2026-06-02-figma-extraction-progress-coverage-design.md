# Figma Extraction Progress Coverage — Design

**Date:** 2026-06-02
**Change:** `figma-extraction-progress-coverage`

## Context

The Figma text extraction pipeline in `packages/review-core/src/figma-extract-mcp.ts` runs three sequential phases:

1. **Metadata fetch** (`fetchMetadataXml`) — calls Figma MCP `get_metadata` to fetch frame XML. For large frames or flow scopes with many nodes, this can take minutes.
2. **Instance scan** (`scanInstanceTextNodes`) — one bulk `use_figma` call to discover TEXT nodes inside component instances. Optional; skipped when no instances exist.
3. **Per-node resolution** (worker pool) — reads character content for each node concurrently. Already has `onProgress` coverage.

Only phase 3 emits progress today. Users see a static "Reading text from Figma…" message for the entire duration of phases 1 and 2 with no movement. Observed at 3m 20s elapsed with zero UI feedback.

## Goals / Non-Goals

**Goals:**
- Emit a progress signal at the start of each dark phase so the UI has something to show
- Extend the `onProgress` callback with a `stage` discriminator that lets the caller format phase-specific messages
- Update the `guideline-generation.ts` caller to display stage-appropriate text

**Non-Goals:**
- Per-fetch progress within `fetchMetadataXml` for flow scopes (multiple nodeIds) — one signal per phase is sufficient
- Progress for `review.ts` or `review-queue.ts` callers (they pass no `onProgress`)
- Any change to persisted schemas or contracts

## Decisions

### D1: Extend `onProgress` with a `stage` field

**Choice:** Add `stage: "metadata" | "scanning" | "reading"` to the existing payload.

```typescript
onProgress?: (p: {
  stage: "metadata" | "scanning" | "reading";
  completed: number;
  total: number;
}) => void
```

**Rationale:** One callback, one wiring point in the caller. Backward-compatible — callers that pass no third argument are unaffected. Callers that destructure `{ completed, total }` still compile; `stage` is additive.

**Alternatives considered:**
- Separate `onStageChange` callback — rejected: two callbacks for one feature, more caller boilerplate
- `message` field set by library — rejected: caller knows display context better; coupling display strings to the library is the wrong altitude

### D2: `completed: 0, total: 0` for metadata and scanning stages

**Choice:** Emit zeros for phases 1 and 2.

**Rationale:** Node count is unknown during these phases. The caller uses `stage` to select the message; `completed`/`total` are only meaningful for `"reading"`. Zeros are unambiguous — they cannot be mistaken for real progress.

### D3: Guard scanning signal on `instanceRefs.length > 0`

**Choice:** Only emit `stage: "scanning"` when the instance scan actually runs.

**Rationale:** When `instanceRefs.length === 0`, `scanInstanceTextNodes` is not called. Emitting a scanning signal would misrepresent the pipeline state.

## Risks / Trade-offs

[Trade-off] `completed: 0, total: 0` for metadata/scanning could look odd if a caller tries to render a progress bar (`0 / 0`). → Accepted: the caller (`guideline-generation.ts`) switches on `stage` and ignores counts for non-reading stages. Future callers should do the same.

[Risk] A caller that destructures only `{ completed, total }` and formats `${completed} / ${total}` would show "0 / 0" during metadata/scanning. → Mitigation: `guideline-generation.ts` is updated in this change. Other callers (`review.ts`, `review-queue.ts`) pass no `onProgress` and are unaffected.

## Migration Plan

N/A — no schema changes, no endpoint changes, no deployment steps. All changes are in `packages/review-core` (library) and `apps/daemon` (caller). Rollback is a revert.

## Open Questions

None — all design decisions resolved.
