## 1. Reset BackdropTuner debug defaults

- [ ] 1.1 In `apps/desktop/src/shell/BackdropTuner.tsx`, change `useState(true)` → `useState(false)` and `useState(1)` → `useState(0.92)`
- [ ] 1.2 Run `npm run typecheck` in `apps/desktop` and confirm no errors

## 2. Fix monotonic onProgress counter

- [ ] 2.1 In `packages/review-core/src/figma-extract-mcp.ts`, add `let completed = 0` alongside `let index = 0` in the worker pool setup (line ~157)
- [ ] 2.2 Replace `onProgress?.({ completed: i + 1, total: cappedRefs.length })` with `onProgress?.({ completed: ++completed, total: cappedRefs.length })`
- [ ] 2.3 Run `npm run test` in `packages/review-core` and confirm the `onProgress` test still passes

## 3. Fix env-var falsy-zero for extraction constants

- [ ] 3.1 In `packages/review-core/src/figma-extract-mcp.ts` line 39, change `Number(process.env.WRITER_FIGMA_MAX_NODES) || 500` → `Number(process.env.WRITER_FIGMA_MAX_NODES ?? 500)`
- [ ] 3.2 Change `Number(process.env.WRITER_FIGMA_READ_CONCURRENCY) || 8` → `Number(process.env.WRITER_FIGMA_READ_CONCURRENCY ?? 8)`
- [ ] 3.3 Run `npm run test` in `packages/review-core` and confirm all tests pass

## 4. Collapse scannedFromInstances double iteration

- [ ] 4.1 In `packages/review-core/src/figma-extract-mcp.ts`, replace the two `.map()` calls over `scannedFromInstances` (lines ~132–141) with a single `forEach` that builds both `scannedById` (Map) and `allRefsFromInstances` (array) in one pass
- [ ] 4.2 Spread `allRefsFromInstances` into `allRefs` in place of the old second `.map()` spread
- [ ] 4.3 Run `npm run test` in `packages/review-core` and confirm all extraction tests pass

## 5. Full verification

- [ ] 5.1 Run `npm run typecheck` from the repo root and confirm no errors
- [ ] 5.2 Run `npm run test` from the repo root and confirm all tests pass
