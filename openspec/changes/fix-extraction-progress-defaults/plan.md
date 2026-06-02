# Fix Extraction Progress & Defaults — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four bugs found in code review of the figma-extraction-perf merge: a debug UI state committed to production, non-monotonic progress reporting, a silent env-override failure, and a redundant iteration.

**Architecture:** All fixes are targeted one-liner edits in two files. No new abstractions, no new tests to write — the existing test suite covers the changed behaviour. Tasks are ordered by risk: UI fix first (isolated, no tests needed), library fixes second (covered by existing tests).

**Tech Stack:** TypeScript (ESM), React 19 `useState`, Vitest, npm workspaces.

---

### Task 1: Reset BackdropTuner debug defaults

**Files:**
- Modify: `apps/desktop/src/shell/BackdropTuner.tsx:17-18`

`BackdropTuner` is a developer overlay toggled with Ctrl+Shift+B. It was left with `open: true` and `opacity: 1` after a tuning session. `AppShell.tsx` renders it unconditionally, so every user sees it open on launch.

- [ ] **Step 1: Open the file and locate the two state defaults**

```
apps/desktop/src/shell/BackdropTuner.tsx
```

Lines 17–18 currently read:
```typescript
const [open, setOpen] = useState(true);
const [opacity, setOpacity] = useState(1);
```

- [ ] **Step 2: Reset both defaults**

Change to:
```typescript
const [open, setOpen] = useState(false);
const [opacity, setOpacity] = useState(0.92);
```

No other lines change. The Ctrl+Shift+B toggle handler and all other logic are unaffected.

- [ ] **Step 3: Typecheck**

```bash
cd apps/desktop && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/shell/BackdropTuner.tsx
git commit -m "fix(desktop): reset BackdropTuner defaults — open=false, opacity=0.92"
```

---

### Task 2: Fix monotonic onProgress counter

**Files:**
- Modify: `packages/review-core/src/figma-extract-mcp.ts:156-166`
- Test: `packages/review-core/src/figma-extract-mcp.test.ts` (run only, no edits)

The worker pool assigns each worker a slot index `i` before the async MCP call. `onProgress` currently fires `completed: i + 1` — the slot position, not the count of nodes actually resolved. With 8 concurrent workers, a worker at slot 5 can finish before workers at slots 0–3, making the counter go backwards (e.g., "6 / 20" then "2 / 20"). Fix: track a separate `completed` counter incremented after each node resolves.

- [ ] **Step 1: Locate the worker pool block**

In `packages/review-core/src/figma-extract-mcp.ts`, find this block (around lines 156–166):

```typescript
const nodes = new Array<FigmaTextNode>(cappedRefs.length);
let index = 0;
async function worker() {
  while (index < cappedRefs.length) {
    const i = index++;
    const ref = cappedRefs[i];
    nodes[i] = scannedById.get(ref.id) ?? await buildTextNode(scope, ref, mcpCaller);
    onProgress?.({ completed: i + 1, total: cappedRefs.length });
  }
}
await Promise.all(Array.from({ length: Math.min(EXTRACTION_CONCURRENCY, cappedRefs.length) }, worker));
```

- [ ] **Step 2: Add the `completed` counter and fix the callback**

Replace the block with:

```typescript
const nodes = new Array<FigmaTextNode>(cappedRefs.length);
let index = 0;
let completed = 0;
async function worker() {
  while (index < cappedRefs.length) {
    const i = index++;
    const ref = cappedRefs[i];
    nodes[i] = scannedById.get(ref.id) ?? await buildTextNode(scope, ref, mcpCaller);
    onProgress?.({ completed: ++completed, total: cappedRefs.length });
  }
}
await Promise.all(Array.from({ length: Math.min(EXTRACTION_CONCURRENCY, cappedRefs.length) }, worker));
```

`++completed` is safe: JavaScript is single-threaded; the prefix increment is not interruptible between workers. The value always increases by 1 after each node resolves regardless of which slot finishes first.

- [ ] **Step 3: Run the onProgress test**

```bash
cd packages/review-core && npm run test -- --reporter=verbose 2>&1 | grep -A 5 "onProgress"
```

Expected output includes:
```
✓ calls onProgress once per node with completed values [1,2,3] and total === 3
✓ completes without error when no onProgress callback is provided
```

- [ ] **Step 4: Run the full review-core test suite**

```bash
cd packages/review-core && npm run test
```

Expected: all tests pass, no failures.

- [ ] **Step 5: Commit**

```bash
git add packages/review-core/src/figma-extract-mcp.ts
git commit -m "fix(review-core): monotonic onProgress — track resolved count, not slot index"
```

---

### Task 3: Fix env-var falsy-zero for extraction constants

**Files:**
- Modify: `packages/review-core/src/figma-extract-mcp.ts:39-40`
- Test: `packages/review-core/src/figma-extract-mcp.test.ts` (run only, no edits)

`Number(process.env.WRITER_FIGMA_MAX_NODES) || 500` treats `"0"` as falsy, so `WRITER_FIGMA_MAX_NODES=0` silently uses 500 instead of 0. The fix is nullish coalescing before the `Number()` call: `Number(process.env.WRITER_FIGMA_MAX_NODES ?? 500)` — the `??` operator only falls back when the env var is `undefined` or `null`, preserving `"0"` as a valid input to `Number()`.

- [ ] **Step 1: Locate the two constants**

In `packages/review-core/src/figma-extract-mcp.ts`, lines 39–40:

```typescript
const MAX_EXTRACTION_NODES = Number(process.env.WRITER_FIGMA_MAX_NODES) || 500;
const EXTRACTION_CONCURRENCY = Number(process.env.WRITER_FIGMA_READ_CONCURRENCY) || 8;
```

- [ ] **Step 2: Apply the fix**

```typescript
const MAX_EXTRACTION_NODES = Number(process.env.WRITER_FIGMA_MAX_NODES ?? 500);
const EXTRACTION_CONCURRENCY = Number(process.env.WRITER_FIGMA_READ_CONCURRENCY ?? 8);
```

Note: `process.env.WRITER_FIGMA_MAX_NODES` is `string | undefined`. When undefined, `?? 500` provides the numeric literal 500, so `Number(500) === 500`. When `"0"`, `?? 500` does not fire, so `Number("0") === 0`. When `""` (empty string), `?? 500` does not fire, so `Number("") === 0` — an edge case, but acceptable (an empty env var is misconfiguration).

- [ ] **Step 3: Run the full review-core test suite**

```bash
cd packages/review-core && npm run test
```

Expected: all tests pass (the cap and concurrency tests do not set the env vars, so they use the defaults and are unaffected).

- [ ] **Step 4: Commit**

```bash
git add packages/review-core/src/figma-extract-mcp.ts
git commit -m "fix(review-core): env-var falsy-zero — Number(env ?? fallback) preserves =0 override"
```

---

### Task 4: Collapse scannedFromInstances double iteration

**Files:**
- Modify: `packages/review-core/src/figma-extract-mcp.ts:132-141`
- Test: `packages/review-core/src/figma-extract-mcp.test.ts` (run only, no edits)

`scannedFromInstances` is currently mapped twice: once to build `scannedById` and once to build the `allRefs` entries. A single `forEach` does both in one pass.

- [ ] **Step 1: Locate the two-pass block**

In `packages/review-core/src/figma-extract-mcp.ts`, find (around lines 132–141):

```typescript
const scannedById = new Map(scannedFromInstances.map((n) => [n.id, n]));
const allRefs: MetadataTextRef[] = [
  ...textRefs,
  ...scannedFromInstances.map((n) => ({
    id: n.id,
    name: n.name,
    path: n.path,
    visible: n.visible
  }))
];
```

- [ ] **Step 2: Replace with a single-pass forEach**

```typescript
const scannedById = new Map<string, FigmaTextNode>();
const allRefsFromInstances: MetadataTextRef[] = [];
for (const n of scannedFromInstances) {
  scannedById.set(n.id, n);
  allRefsFromInstances.push({ id: n.id, name: n.name, path: n.path, visible: n.visible });
}
const allRefs: MetadataTextRef[] = [...textRefs, ...allRefsFromInstances];
```

`FigmaTextNode` is imported at the top of the file (it is used as the array element type in `const nodes = new Array<FigmaTextNode>(...)`). The `Map<string, FigmaTextNode>()` type annotation matches the existing implicit type — no import changes needed.

- [ ] **Step 3: Run the full review-core test suite**

```bash
cd packages/review-core && npm run test
```

Expected: all tests pass. The extraction behaviour is identical — the `for...of` loop produces exactly the same `scannedById` Map and `allRefs` array contents as the two `.map()` calls.

- [ ] **Step 4: Commit**

```bash
git add packages/review-core/src/figma-extract-mcp.ts
git commit -m "chore(review-core): single-pass scannedFromInstances — collapse two map() calls"
```

---

### Task 5: Full verification

**Files:** none modified — verification only.

- [ ] **Step 1: Typecheck the entire repo**

```bash
cd C:/WRI/Writer && npm run typecheck
```

Expected: no errors across all packages. (Each package's `typecheck` was checked individually; this confirms no cross-package type breakage.)

- [ ] **Step 2: Run the entire test suite**

```bash
cd C:/WRI/Writer && npm run test
```

Expected: all tests pass. Key suites to confirm green:
- `packages/review-core` — extraction, progress, cap, concurrency, fallback tests
- `apps/daemon` — guideline-generation tests (uses the extraction pipeline)
- `packages/agent-adapters` — Devin adapter tests (DEVIN_MODEL_TEMPORARILY_PINNED-gated)
