## Why

The figma-extraction-perf merge introduced a parallel worker pool and progress callback for Figma text extraction. A code review of those commits found four bugs: a debug UI overlay left open for all users, a progress counter that goes backwards under real concurrency, an env-override that silently ignores `=0`, and a redundant array iteration. These are low-risk one-liner fixes that should land together before users are further affected by the open tuner panel.

## What Changes

**BackdropTuner defaults**
- From: `useState(true)` / `useState(1)` — tuner panel open and fully opaque on every launch
- To: `useState(false)` / `useState(0.92)` — tuner panel closed by default
- Reason: Debug state committed during backdrop tuning session
- Impact: Non-breaking; affects only the dev overlay visible to end users

**`onProgress.completed` value**
- From: `completed: i + 1` (slot index, non-monotonic under concurrency)
- To: `completed: ++completedCount` (count of nodes resolved, always increasing)
- Reason: With 8 concurrent workers, slot 5 can finish before slot 0, producing backwards UI counters
- Impact: Non-breaking; progress display in guideline generation now monotonically increases

**Env-var constants**
- From: `Number(process.env.WRITER_FIGMA_MAX_NODES) || 500` (silently ignores `=0`)
- To: `Number(process.env.WRITER_FIGMA_MAX_NODES ?? 500)` (treats `=0` as valid)
- Reason: Diverged from plan doc's intended `?? fallback` form; `0 || 500` defeats the override
- Impact: Non-breaking; only affects operators explicitly setting the var to `0`

**`scannedFromInstances` iteration**
- From: Two `.map()` calls over the same array
- To: One `forEach` building both `scannedById` Map and `allRefsFromInstances` array
- Reason: Redundant pass; no functional difference
- Impact: Non-breaking cleanup

## Capabilities

### New Capabilities

None — these are bug fixes, not new capabilities.

### Modified Capabilities

- `figma-mcp-extraction`: `onProgress` contract now guarantees monotonically-increasing `completed` values; `WRITER_FIGMA_MAX_NODES=0` and `WRITER_FIGMA_READ_CONCURRENCY=0` are now valid overrides.

## Impact

- `apps/desktop/src/shell/BackdropTuner.tsx` — two state defaults reset
- `packages/review-core/src/figma-extract-mcp.ts` — three fixes (onProgress counter, env constants, iteration)
- `packages/review-core/src/figma-extract-mcp.test.ts` — existing onProgress test assertions remain valid (fake callers resolve in microtask FIFO order, so `[1, 2, 3]` still holds)
