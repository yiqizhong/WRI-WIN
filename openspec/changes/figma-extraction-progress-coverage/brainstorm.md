<!--
Raw capture of superpowers:brainstorming output.
-->

# Brainstorm — figma-extraction-progress-coverage

## Background

The Figma text extraction pipeline has three phases, but `onProgress` only covers the third:

1. `fetchMetadataXml` — fetches frame XML from Figma MCP. **Silent.** Can take minutes on large frames.
2. `scanInstanceTextNodes` — one bulk `use_figma` call to find TEXT nodes inside component instances. **Silent.**
3. Worker pool per-node — already fires `onProgress` via `++completed`.

Users see a static "Reading text from Figma…" for the entire duration of phases 1 and 2. Observed in production: 3m 20s elapsed with zero UI movement.

## Clarifying question answered

**Q:** How should progress be reported for phases 1 and 2, which have no node count?
**A:** Extend `onProgress` with a `stage` field. Caller formats message per stage.

## Approaches considered

**A — Extend `onProgress` with `stage` (chosen)**
One callback, one wiring point. Backward-compatible — callers passing no third arg unaffected.

**B — Separate `onStageChange` callback**
Cleaner separation but more API surface. Rejected — two callbacks to wire for one feature.

**C — Message from library**
Simpler caller but loses control over wording. Rejected — caller knows display context better.

## Decision chain

### Q1 — What stages need signals?

Three phases, two currently dark:
- `"metadata"` — before `fetchMetadataXml`
- `"scanning"` — before `scanInstanceTextNodes` (only when instances exist)
- `"reading"` — per-node in worker pool (already exists, just gains `stage` field)

### Q2 — What values for `completed` and `total` in metadata/scanning stages?

`0` / `0` — we don't know node count yet. The caller uses `stage` to decide the message, not the counts.

### Q3 — Should `scanInstanceTextNodes` fire a signal when there are no instances?

No. If `instanceRefs.length === 0`, the scan is skipped entirely — no signal needed. Only fire when the call actually happens.

### Q4 — Do we need to update contracts / schemas?

No. `onProgress` is a callback parameter, not a persisted shape. No Zod changes.

## Design (approved)

**Callback signature change:**
```typescript
onProgress?: (p: {
  stage: "metadata" | "scanning" | "reading";
  completed: number;
  total: number;
}) => void
```

**Emission points in `extractFigmaTextNodesViaMcp`:**
1. Before `fetchMetadataXml` → `{stage: "metadata", completed: 0, total: 0}`
2. Before `scanInstanceTextNodes` (only when `instanceRefs.length > 0`) → `{stage: "scanning", completed: 0, total: 0}`
3. Worker pool per-node → `{stage: "reading", completed: ++completed, total: cappedRefs.length}`

**Caller update in `guideline-generation.ts`:**
```
metadata  → "Reading text from Figma… fetching metadata"
scanning  → "Reading text from Figma… scanning instances"
reading   → "Reading text from Figma… {completed} / {total}"
```

**Test additions:**
- Stage "metadata" fires before any nodes resolve
- Stage "scanning" fires when instances are present, not when absent
- Stage "reading" per-node sequence unchanged
- Existing onProgress tests updated to include `stage` in expectations
