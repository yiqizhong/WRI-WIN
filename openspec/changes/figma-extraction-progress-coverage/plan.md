# Figma Extraction Progress Coverage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit `onProgress` signals at the start of the two currently-silent extraction phases (metadata fetch and instance scan) so users see movement immediately instead of a frozen "Reading text from Figma…" for minutes.

**Architecture:** The `onProgress` callback gains a `stage` discriminator (`"metadata" | "scanning" | "reading"`). The library emits once at phase entry for metadata and scanning (with `completed: 0, total: 0`), and per-node for reading (unchanged). The `guideline-generation.ts` caller switches on `stage` to format a phase-specific message.

**Tech Stack:** TypeScript (ESM), Vitest, npm workspaces. No schema changes.

---

### Task 1: Extend onProgress with stage — library (TDD)

**Files:**
- Modify: `packages/review-core/src/figma-extract-mcp.ts:104-107, 119, 131-134, 162-168`
- Test: `packages/review-core/src/figma-extract-mcp.test.ts`

Working directory for all commands: `C:\WRI\Writer`

---

- [ ] **Step 1: Update the existing onProgress test to expect `stage`**

In `packages/review-core/src/figma-extract-mcp.test.ts`, find the test at line ~450:

```typescript
it("calls onProgress once per node with completed values [1,2,3] and total === 3", async () => {
  const progressValues: Array<{ completed: number; total: number }> = [];

  const result = await extractFigmaTextNodesViaMcp(
    frameScope,
    createFakeCaller({ metadata: makeMetadata(3) }),
    (p) => {
      progressValues.push(p);
    }
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(progressValues).toHaveLength(3);
  expect(progressValues.every((p) => p.total === 3)).toBe(true);
  expect(progressValues.map((p) => p.completed)).toEqual([1, 2, 3]);
});
```

Replace it with:

```typescript
it("calls onProgress once per node with stage='reading' and completed values [1,2,3]", async () => {
  const progressValues: Array<{ stage: string; completed: number; total: number }> = [];

  const result = await extractFigmaTextNodesViaMcp(
    frameScope,
    createFakeCaller({ metadata: makeMetadata(3) }),
    (p) => {
      progressValues.push(p);
    }
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;

  const readingValues = progressValues.filter((p) => p.stage === "reading");
  expect(readingValues).toHaveLength(3);
  expect(readingValues.every((p) => p.total === 3)).toBe(true);
  expect(readingValues.map((p) => p.completed)).toEqual([1, 2, 3]);
});
```

- [ ] **Step 2: Add test — metadata stage fires first**

Add this test immediately after the test you just updated:

```typescript
it("fires stage='metadata' before any reading events", async () => {
  const stages: string[] = [];

  await extractFigmaTextNodesViaMcp(
    frameScope,
    createFakeCaller({ metadata: makeMetadata(3) }),
    (p) => {
      stages.push(p.stage);
    }
  );

  expect(stages[0]).toBe("metadata");
  expect(stages.filter((s) => s === "metadata")).toHaveLength(1);
});
```

- [ ] **Step 3: Add test — scanning stage fires when instances present, not when absent**

Add after the metadata test:

```typescript
it("fires stage='scanning' when frame contains instances, not when it does not", async () => {
  const metadataWithInstance = `
<frame id="1:10" name="Login" type="FRAME">
  <instance id="I1:20" name="Button" type="INSTANCE" />
  <text id="1:11" name="Label" type="TEXT" visible="true" />
</frame>
`;
  const metadataNoInstance = makeMetadata(2);

  const stagesWithInstance: string[] = [];
  await extractFigmaTextNodesViaMcp(
    frameScope,
    createFakeCaller({ metadata: metadataWithInstance }),
    (p) => { stagesWithInstance.push(p.stage); }
  );

  const stagesNoInstance: string[] = [];
  await extractFigmaTextNodesViaMcp(
    frameScope,
    createFakeCaller({ metadata: metadataNoInstance }),
    (p) => { stagesNoInstance.push(p.stage); }
  );

  expect(stagesWithInstance).toContain("scanning");
  expect(stagesNoInstance).not.toContain("scanning");
});
```

- [ ] **Step 4: Add test — scanning stage carries completed=0, total=0**

Add after the scanning test:

```typescript
it("fires stage='scanning' with completed=0 and total=0", async () => {
  const metadataWithInstance = `
<frame id="1:10" name="Login" type="FRAME">
  <instance id="I1:20" name="Button" type="INSTANCE" />
  <text id="1:11" name="Label" type="TEXT" visible="true" />
</frame>
`;

  const scanningEvents: Array<{ completed: number; total: number }> = [];
  await extractFigmaTextNodesViaMcp(
    frameScope,
    createFakeCaller({ metadata: metadataWithInstance }),
    (p) => {
      if (p.stage === "scanning") scanningEvents.push({ completed: p.completed, total: p.total });
    }
  );

  expect(scanningEvents).toHaveLength(1);
  expect(scanningEvents[0]).toEqual({ completed: 0, total: 0 });
});
```

- [ ] **Step 5: Run the tests — confirm they fail**

```bash
cd C:\WRI\Writer && npm run test --workspace=packages/review-core 2>&1 | tail -20
```

Expected: failures mentioning `stage` not found on the progress object, and `metadata`/`scanning` not in stages array.

- [ ] **Step 6: Update the callback signature in figma-extract-mcp.ts**

In `packages/review-core/src/figma-extract-mcp.ts`, change line 107:

```typescript
// FROM:
  onProgress?: (p: { completed: number; total: number }) => void

// TO:
  onProgress?: (p: { stage: "metadata" | "scanning" | "reading"; completed: number; total: number }) => void
```

- [ ] **Step 7: Emit metadata stage before fetchMetadataXml**

In `packages/review-core/src/figma-extract-mcp.ts`, find line ~119 (just before `const metadataXml = await fetchMetadataXml(...)`):

```typescript
// INSERT before the fetchMetadataXml call:
  onProgress?.({ stage: "metadata", completed: 0, total: 0 });
  const metadataXml = await fetchMetadataXml(scope, mcpCaller);
```

- [ ] **Step 8: Emit scanning stage before scanInstanceTextNodes**

Find the instance scan block (~lines 131-134):

```typescript
// FROM:
  const scannedFromInstances =
    instanceRefs.length > 0
      ? await scanInstanceTextNodes(scope, instanceRefs, textRefs, mcpCaller)
      : [];

// TO:
  if (instanceRefs.length > 0) {
    onProgress?.({ stage: "scanning", completed: 0, total: 0 });
  }
  const scannedFromInstances =
    instanceRefs.length > 0
      ? await scanInstanceTextNodes(scope, instanceRefs, textRefs, mcpCaller)
      : [];
```

- [ ] **Step 9: Add stage to the reading emission in the worker pool**

Find the onProgress call inside the worker function (~line 167):

```typescript
// FROM:
      onProgress?.({ completed: ++completed, total: cappedRefs.length });

// TO:
      onProgress?.({ stage: "reading", completed: ++completed, total: cappedRefs.length });
```

- [ ] **Step 10: Run tests — confirm they pass**

```bash
cd C:\WRI\Writer && npm run test --workspace=packages/review-core 2>&1 | tail -10
```

Expected:
```
Test Files  14 passed (14)
     Tests  101 passed (101)
```

- [ ] **Step 11: Commit**

```bash
git add packages/review-core/src/figma-extract-mcp.ts packages/review-core/src/figma-extract-mcp.test.ts
git commit -m "feat(review-core): emit stage signals for metadata and scanning phases in onProgress"
```

---

### Task 2: Update guideline-generation.ts caller

**Files:**
- Modify: `apps/daemon/src/guideline-generation.ts:117-126`

---

- [ ] **Step 1: Locate the callback in guideline-generation.ts**

Find this block (~lines 117-126):

```typescript
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

- [ ] **Step 2: Update the callback to switch on stage**

Replace with:

```typescript
  const extraction = await extractFigmaTextNodesViaMcp(figmaScope, createFigmaMcpCaller(state), ({ stage, completed, total }) => {
    const now = Date.now();
    if (now - lastProgressMs >= 1000) {
      lastProgressMs = now;
      const message =
        stage === "metadata" ? "Reading text from Figma… fetching metadata" :
        stage === "scanning" ? "Reading text from Figma… scanning instances" :
        `Reading text from Figma… ${completed} / ${total}`;
      void updateGuidelineGenerationProgress(state, session, {
        stage: "extracting_figma",
        message
      });
    }
  });
```

- [ ] **Step 3: Typecheck**

```bash
cd C:\WRI\Writer && npm run typecheck 2>&1 | grep -E "error|Error" | head -10
```

Expected: no output (no errors).

- [ ] **Step 4: Run full test suite**

```bash
cd C:\WRI\Writer && npm run test --workspace=packages/review-core && npm run test --workspace=apps/daemon 2>&1 | tail -15
```

Expected: review-core all pass, daemon all pass (the 1 pre-existing daemon failure on `agents.test.ts` is unrelated to this change — it was present before this branch).

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/guideline-generation.ts
git commit -m "feat(daemon): format stage-specific messages in Figma extraction progress callback"
```
