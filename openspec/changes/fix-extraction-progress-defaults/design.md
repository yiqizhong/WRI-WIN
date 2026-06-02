## Context

The figma-extraction-perf feature (merged 2026-06-02) introduced a parallel worker pool
for `extractFigmaTextNodesViaMcp` and a progress callback for guideline generation. A
subsequent UI-polish commit adjusted Backdrop defaults for tuning. Code review of those
commits found four bugs: a debug UI state left in production, non-monotonic progress
reporting, a silent env-override failure, and a redundant iteration.

Affected paths:
- `apps/desktop/src/shell/BackdropTuner.tsx`
- `packages/review-core/src/figma-extract-mcp.ts`

## Goals / Non-Goals

**Goals:**
- Reset `BackdropTuner` defaults to their pre-tuning values so the debug panel does not appear for users.
- Make `onProgress.completed` monotonically increase by tracking resolved-node count, not slot index.
- Fix `WRITER_FIGMA_MAX_NODES=0` and `WRITER_FIGMA_READ_CONCURRENCY=0` env overrides being silently ignored.
- Collapse the two-pass iteration over `scannedFromInstances` into one.

**Non-Goals:**
- Surfacing `extraction.warnings` at a higher level in `review.ts` (warnings are already in the contract schema and serialized in the response).
- Any change to the worker pool concurrency logic, cap value, or MCP call behaviour.
- UI changes beyond resetting the two state defaults.

## Decisions

### D1: Reset BackdropTuner to `open: false`, `opacity: 0.92`
- **Choice:** Restore the two `useState` defaults to their pre-tuning values.
- **Rationale:** `AppShell.tsx` renders `<BackdropTuner />` on every screen. `open: true` forces the tuner panel open for all users on every launch. The component is development-only (JSDoc: "bake the ones you like into writer-window-background.css").
- **Alternative considered:** Add a `DEV`-mode guard (`import.meta.env.DEV`). Rejected — the component is harmless when closed; adding a build-time branch is unnecessary complexity for a one-line reset.

### D2: Monotonic `onProgress` via separate `completed` counter
- **Choice:** Add `let completed = 0` alongside `let index = 0`. After each node resolves (cache hit or MCP call), emit `onProgress?.({ completed: ++completed, total: cappedRefs.length })`.
- **Rationale:** `i + 1` is the slot position assigned before the async MCP call. With 8 concurrent workers, a later slot can resolve before earlier ones, causing backwards jumps (e.g., "8 / 20" → "3 / 20"). `++completed` is safe in JS (single-threaded); it counts nodes actually resolved, always increasing.
- **Alternative considered:** Sort progress events in the caller (guideline-generation.ts). Rejected — the correct count should come from the source; sorting at the call site is a workaround, not a fix.

### D3: `Number(env ?? fallback)` for env-var constants
- **Choice:** Change `Number(process.env.WRITER_FIGMA_MAX_NODES) || 500` to `Number(process.env.WRITER_FIGMA_MAX_NODES ?? 500)`, and same for concurrency.
- **Rationale:** `Number("0") === 0` is falsy; `0 || 500 === 500` silently discards the override. The plan doc originally wrote `Number(env ?? 500)` — nullish coalescing before `Number()` only falls back on `undefined`/`null`, preserving `"0"` as a valid override.
- **Alternative considered:** Explicit ternary `env !== undefined ? Number(env) : 500`. Equivalent correctness, slightly more verbose. `?? fallback` inside `Number()` is idiomatic and matches the plan doc.

### D4: Single-pass `scannedFromInstances` iteration
- **Choice:** Replace the two `.map()` calls with one `forEach` that populates both `scannedById` (Map) and `allRefsFromInstances` (array).
- **Rationale:** The two-pass form is clear but redundant — the same array is traversed twice for no functional reason. A single pass builds both structures.
- **Alternative considered:** Keep two passes. No functional difference; rejected for cleanliness.

## Risks / Trade-offs

[Risk] `++completed` is called after each node, including cache hits (`scannedById.get(ref.id)`). Cache hits resolve synchronously (no microtask yield), so multiple cache hits in sequence could fire `onProgress` rapidly. → Mitigation: The 1-second throttle in `guideline-generation.ts` already handles burst callbacks; no change needed there.

[Trade-off] `Number(env ?? fallback)` still converts empty string `""` to `0`. An operator who sets `WRITER_FIGMA_MAX_NODES=` (empty) would get a cap of 0, extracting no nodes. → Accepted: an empty env var is misconfiguration; the fix targets the `=0` case which was the reported divergence from the plan.

## Migration Plan

N/A — pure code fix, no deployment steps, no schema changes, no endpoint changes. Rollback is revert of the commit.

## Open Questions

None — all design decisions resolved.
