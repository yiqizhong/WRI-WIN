<!--
Raw capture of superpowers:brainstorming output.
-->

# Brainstorm — fix-extraction-progress-defaults

## Background

Code review of the last 3 commits on `main` (figma-extraction-perf merge + UI polish)
surfaced 5 findings. Finding #4 was dropped after investigation — `extraction.warnings`
is already in the `FigmaTextExtraction` contract schema and serialized in the HTTP
response; callers already have access. Four actionable bugs remain.

## Findings in scope

| # | File | Line | Issue |
|---|------|------|-------|
| 1 | `apps/desktop/src/shell/BackdropTuner.tsx` | 17–18 | Debug defaults `open: true`, `opacity: 1` committed; ships to all users |
| 2 | `packages/review-core/src/figma-extract-mcp.ts` | 163 | `onProgress` reports slot-index+1, not resolved-node count — non-monotonic under real concurrency |
| 3 | `packages/review-core/src/figma-extract-mcp.ts` | 39–40 | `Number(env) \|\| fallback` silently ignores `=0` env override |
| 5 | `packages/review-core/src/figma-extract-mcp.ts` | 133 | `scannedFromInstances` iterated twice |

## Clarifying question answered

**Q:** For finding #4 (truncation warnings in `extractFigmaNodes`) — surface them or leave as-is?
**A:** Leave as-is. `extraction.warnings` is already in the contract and serialized; no shape change needed.

## Approaches considered

**A — Single PR, all 4 fixes (chosen)**
One commit, low risk, full context for reviewers. All changes are one-liners or near-one-liners in the same subsystem (extraction library + one UI file).

**B — Two PRs: UI hotfix first**
Ship `BackdropTuner` immediately, library fixes later. More overhead than the tiny diffs justify.

**C — Direct commits**
Faster, skips PR signal and OpenSpec tracking.

**Decision: A.** Ship all four fixes together.

## Decision chain

### Q1 — Is `++completed` safe with concurrent workers?

Yes. JavaScript is single-threaded; the `++` prefix operator is not interruptible between
increment and assignment. Workers compete for `index` (also safe for the same reason), and
`++completed` after each resolved node gives a monotonically-increasing count regardless of
which slot resolves first.

### Q2 — Why does `Number(env) || fallback` fail for `=0`?

`Number("0") === 0` is falsy, so `0 || 500 === 500`. The plan doc originally used
`Number(env ?? 500)` — nullish coalescing before the `Number()` call — which only falls
back when the env var is `undefined` or `null`, not when it's `"0"`. The implementation
diverged during coding.

### Q3 — Is `open: true` definitely a bug, not intentional?

Yes. `AppShell.tsx` renders `<BackdropTuner />` unconditionally on every screen.
The JSDoc says "toggle with Ctrl+Shift+B; bake the ones you like into
writer-window-background.css." The previous commit had `false`/`0.92`. The tuning session
left debug state in production code.

### Q4 — Double iteration cost?

`scannedFromInstances` can hold up to `MAX_EXTRACTION_NODES` entries (500 by default).
Two `.map()` passes = 1,000 iterations max, minimal wall-clock impact. Still worth collapsing
for clarity and to remove the redundant allocation.

## Design (approved)

| Fix | Change |
|-----|--------|
| BackdropTuner defaults | `useState(false)` + `useState(0.92)` |
| Monotonic `onProgress` | Add `let completed = 0`; emit `++completed` after each node resolves |
| Env falsy-zero | `Number(env ?? 500)` / `Number(env ?? 8)` |
| Double iteration | One `forEach` building both `scannedById` Map and `allRefsFromInstances` array |
