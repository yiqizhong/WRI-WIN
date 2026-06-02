# Figma Extraction Perf Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development
> to implement this plan task-by-task.

**Goal:** Replace the sequential Figma text-node read loop with a bounded-concurrency parallel pool (8 workers), cap reads at 500 nodes, and thread a live progress callback from extractor to daemon `progressMessage`.

**Architecture:** All extractor changes live in `packages/review-core/src/figma-extract-mcp.ts`. The daemon wires the new optional `onProgress` callback in `apps/daemon/src/guideline-generation.ts` at the `extractFigmaTextNodesViaMcp` call site (line 113). No schema, UI, or dependency changes.

**Tech Stack:** TypeScript (ESM), Vitest, npm workspaces

---

## Task 1: Cap extraction at 500 nodes

- [ ] **Step 1 (test first):** In `packages/review-core/src/figma-extract-mcp.test.ts`, add a test that creates 600 fake text refs in `FRAME_METADATA`, calls `extractFigmaTextNodesViaMcp`, and asserts `extraction.nodes.length === 500` and `extraction.warnings` contains a string matching `/500 of 600/`.
- [ ] **Step 2 (test first):** Add a second test with 300 refs: asserts all 300 nodes returned and `extraction.warnings` is empty.
- [ ] **Step 3 (implement):** At the top of `figma-extract-mcp.ts` (after imports), add:
  ```ts
  const MAX_EXTRACTION_NODES = Number(process.env.WRITER_FIGMA_MAX_NODES ?? 500);
  ```
- [ ] **Step 4 (implement):** In `extractFigmaTextNodesViaMcp`, after both `textRefs` and `scannedFromInstances` are collected but before the read loop, merge them into `allRefs: MetadataTextRef[]`. Slice to `MAX_EXTRACTION_NODES`. If truncated, push a warning string like `"Analyzed the first 500 of N text nodes"` into a local `warnings: string[]`.
- [ ] **Step 5 (implement):** Propagate `warnings` into `extraction.warnings` (change `warnings: []` to `warnings`).
- [ ] **Step 6 (verify):** `npm run test --workspace packages/review-core` — both new cap tests pass.

---

## Task 2: Bounded-concurrency parallel reads

- [ ] **Step 1 (test first):** In `figma-extract-mcp.test.ts`, add a test: create 10 refs with a fake caller that tracks concurrent in-flight calls, assert that peak concurrency never exceeds 8 and all 10 results are returned in original order.
- [ ] **Step 2 (test first):** Add a test: one ref throws from `buildTextNode` (use `failDesignContextFor`); assert the throwing ref produces a fallback node and all other refs still resolve.
- [ ] **Step 3 (implement):** Add constant after `MAX_EXTRACTION_NODES`:
  ```ts
  const EXTRACTION_CONCURRENCY = Number(process.env.WRITER_FIGMA_READ_CONCURRENCY ?? 8);
  ```
- [ ] **Step 4 (implement):** Replace the sequential `for` loop over `textRefs` (lines 128-130 in original) with an inline promise pool. Pattern:
  ```ts
  const results = new Array<FigmaTextNode>(allRefs.length);
  let index = 0;
  async function worker() {
    while (index < allRefs.length) {
      const i = index++;
      results[i] = await buildTextNode(scope, allRefs[i], mcpCaller);
      onProgress?.({ completed: i + 1, total: allRefs.length });
    }
  }
  await Promise.all(Array.from({ length: Math.min(EXTRACTION_CONCURRENCY, allRefs.length) }, worker));
  ```
  (Remove the separate `scannedFromInstances` push loop — instances are now folded into `allRefs` before the pool.)
- [ ] **Step 5 (verify):** `npm run test --workspace packages/review-core` — all tests pass including the new concurrency/order/failure tests.

---

## Task 3: Live progress callback

- [ ] **Step 1 (test first):** In `figma-extract-mcp.test.ts`, add a test: provide `onProgress` callback, run extraction with 3 refs, assert callback called 3 times with `completed` values `[1, 2, 3]` and `total === 3`.
- [ ] **Step 2 (test first):** Add a test: no `onProgress` provided — extraction completes without error.
- [ ] **Step 3 (implement):** Update the `extractFigmaTextNodesViaMcp` signature:
  ```ts
  export async function extractFigmaTextNodesViaMcp(
    scope: FigmaReviewScope,
    mcpCaller: McpCaller,
    onProgress?: (p: { completed: number; total: number }) => void
  ): Promise<FigmaExtractionResult>
  ```
- [ ] **Step 4 (implement):** The `onProgress?.({ completed: i + 1, total: allRefs.length })` call is already in the pool from Task 2 Step 4.
- [ ] **Step 5 (implement):** In `apps/daemon/src/guideline-generation.ts`, at line 113, replace:
  ```ts
  const extraction = await extractFigmaTextNodesViaMcp(figmaScope, createFigmaMcpCaller(state));
  ```
  with:
  ```ts
  let lastProgressMs = 0;
  const extraction = await extractFigmaTextNodesViaMcp(figmaScope, createFigmaMcpCaller(state), ({ completed, total }) => {
    const now = Date.now();
    if (now - lastProgressMs >= 1000) {
      lastProgressMs = now;
      void updateGuidelineGenerationProgress(state, session, {
        stage: "extracting_figma",
        message: `Reading text from Figma… ${completed} / ${total}`
      });
    }
  });
  ```
- [ ] **Step 6 (verify):** `npm run test --workspace packages/review-core` — progress callback tests pass.

---

## Task 4: Typecheck and regression

- [ ] **Step 1:** `npm run typecheck` from repo root — zero errors.
- [ ] **Step 2:** `npm run test` from repo root — all existing `guideline-generation` tests and `figma-extract-mcp` tests pass.
