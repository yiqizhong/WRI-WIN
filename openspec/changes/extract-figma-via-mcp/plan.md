# Figma Frame Review And Approved Writeback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a selected Figma Frame link into a real review session whose approved text edits can be explicitly and safely written back to the originating Figma text nodes.

**Architecture:** `@writer/review-core` parses one selected Frame and extracts real node text through an injected read adapter. The daemon owns the connected Figma MCP client, persistence, audit input, permission checks, and a batch `use_figma` write operation with stale-text conflict protection. The desktop remains a control surface for connection recovery, approval/editing, and explicit apply.

**Tech Stack:** TypeScript ESM, Zod 4 contracts, Vitest, npm workspaces, Electron/React/Carbon desktop UI, `@modelcontextprotocol/sdk`, Figma MCP `get_metadata`, `get_design_context`, and `use_figma`.

**Tracking:** `WRI-98` parent; execute `WRI-99` -> `WRI-100` -> `WRI-101` -> `WRI-102`.

**Commit policy:** The repository requires explicit user permission before committing. Each task includes its intended commit and Linear comment, but do not run those commit steps until that permission is given.

---

## Baseline Gate

The isolated worktree is `/Users/yiqizhong/.config/superpowers/worktrees/Writer/figma-mcp`. Before implementation, `npm run typecheck` passed and `npm run test` failed in the pre-existing daemon integration assertion at `apps/daemon/src/integration.test.ts:68` because the `echo` adapter was not present/available. Do not attribute that baseline failure to this change; either investigate it first or proceed only with explicit acceptance of the known baseline.

### Task 1: Frame Intake And Shared Session Contracts (`WRI-99`)

**Files:**
- Modify: `packages/contracts/src/figma-scope.ts`
- Modify: `packages/contracts/src/figma-scope.test.ts`
- Modify: `packages/contracts/src/connection-diagnostic.ts`
- Modify: `packages/contracts/src/connection-diagnostic.test.ts`
- Modify: `packages/contracts/src/figma-text-node.ts`
- Modify: `packages/contracts/src/review-session.ts`
- Create: `packages/contracts/src/review-queue.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/storage/src/store.test.ts`
- Modify: `packages/review-core/src/figma-url.ts`
- Modify: `packages/review-core/src/figma-url.test.ts`

- [ ] **Step 1: Write failing Frame URL and contract tests**

Add tests that require only a selected design Frame and require persisted extraction fields:

```ts
it("rejects design URLs without a selected frame node id", () => {
  expect(() => parseFigmaUrl("https://www.figma.com/design/file/Demo")).toThrow(
    "Select a Figma Frame and paste its link"
  );
});

it("rejects non-design Figma sources", () => {
  expect(() => parseFigmaUrl("https://www.figma.com/make/file/Demo")).toThrow(
    "selected Figma design Frame"
  );
});

it("parses sessions carrying real frame extraction and diagnostics", () => {
  const session = parseReviewSession({
    id: "session-1",
    projectId: "project-1",
    sourceType: "figma",
    scope: { kind: "frame", fileKey: "file", nodeId: "1:2" },
    status: "draft",
    agentRunIds: [],
    figmaExtraction: {
      scope: { kind: "frame", fileKey: "file", nodeId: "1:2" },
      nodes: [{ id: "3:4", name: "Button", path: ["Frame", "Button"], characters: "Pay now", visible: true }],
      warnings: [],
      extractedAt: "2026-05-24T00:00:00.000Z"
    },
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:00:00.000Z"
  });
  expect(session.figmaExtraction?.nodes[0]?.id).toBe("3:4");
});
```

- [ ] **Step 2: Run contract tests to observe RED**

Run:

```bash
npm --workspace @writer/contracts test -- src/figma-scope.test.ts src/review-session.test.ts src/connection-diagnostic.test.ts
npm --workspace @writer/review-core test -- src/figma-url.test.ts
```

Expected: tests fail because a file-wide URL is currently accepted and the new diagnostic/session fields are not defined.

- [ ] **Step 3: Implement the minimum shared contracts and Frame parser**

Update scope to Frame-only and add persisted result types:

```ts
export const figmaScopeKindSchema = z.literal("frame");
export const figmaReviewScopeSchema = z.object({
  kind: z.literal("frame"),
  fileKey: z.string().min(1),
  nodeId: z.string().min(1),
  frameName: z.string().optional()
});

export const figmaTextExtractionSchema = z.object({
  scope: figmaReviewScopeSchema,
  nodes: z.array(figmaTextNodeSchema),
  warnings: z.array(connectionDiagnosticSchema).default([]),
  extractedAt: z.iso.datetime()
});

export const reviewQueueSchema = z.object({
  findings: z.array(uxCopyFindingSchema),
  rewrites: z.array(rewriteCandidateSchema),
  changes: z.array(reviewChangeSchema),
  diagnostic: connectionDiagnosticSchema.optional()
});
```

Extend `connectionDiagnosticCodeSchema` with `unsupported_source`, `mcp_not_ready`, `partial_read_failure`, `write_conflict`, and `write_failed`. Extend `reviewSessionSchema` with optional `figmaExtraction`, `designContext`, and `diagnostic`. Change `parseFigmaUrl` so it only returns `{ kind: "frame", fileKey, nodeId }` for `/design/` URLs with `node-id`.

- [ ] **Step 4: Prove persistence survives reload**

Add to `packages/storage/src/store.test.ts` a session round-trip carrying a `figmaExtraction` and verify the reloaded session retains node `id` and `characters`.

Run:

```bash
npm --workspace @writer/contracts test
npm --workspace @writer/review-core test
npm --workspace @writer/storage test
npm run typecheck
```

Expected: all commands pass; the known full-suite daemon baseline is not part of this task gate.

- [ ] **Step 5: Task checkpoint and Linear synchronization**

Mark OpenSpec tasks `1.1` through `1.4` complete only after the tests pass. When commits are authorized:

```bash
git add packages/contracts packages/review-core/src/figma-url.ts packages/review-core/src/figma-url.test.ts packages/storage/src/store.test.ts openspec/changes/extract-figma-via-mcp/tasks.md
git commit -m "feat(figma): define frame extraction session contracts"
```

Then move `WRI-99` to Done and comment with the commit SHA and verification commands.

### Task 2: MCP Frame Extraction Core (`WRI-100`)

**Files:**
- Create: `packages/contracts/src/mcp-call.ts`
- Create: `packages/review-core/src/figma-mcp-reader.ts`
- Create: `packages/review-core/src/figma-extract-mcp.ts`
- Create: `packages/review-core/src/figma-extract-mcp.test.ts`
- Modify: `packages/review-core/src/index.ts`
- Remove after replacement: `packages/review-core/src/figma-extract.ts`
- Remove after replacement: `packages/review-core/src/design-context.ts`

- [ ] **Step 1: Add failing fixture tests for real Frame extraction**

Create a fake reader with recorded MCP-shaped text payloads:

```ts
const reader: FigmaMcpReader = {
  status: "connected",
  getMetadata: async () => ({
    ok: true,
    result: { content: [{ type: "text", text: '<frame id="1:2" name="Checkout"><text id="3:4" name="CTA" /></frame>' }] }
  }),
  getDesignContext: async (_fileKey, nodeId) => ({
    ok: true,
    result: { content: [{ type: "text", text: nodeId === "3:4" ? "<span>Pay now</span>" : "" }] }
  })
};

it("extracts actual text with original text node identity", async () => {
  const result = await extractFigmaFrameViaMcp({ kind: "frame", fileKey: "file", nodeId: "1:2" }, reader);
  expect(result.extraction?.nodes).toMatchObject([{ id: "3:4", characters: "Pay now" }]);
});

it("returns mcp_not_ready without synthetic nodes when disconnected", async () => {
  const result = await extractFigmaFrameViaMcp(scope, { ...reader, status: "disconnected" });
  expect(result.diagnostic?.code).toBe("mcp_not_ready");
  expect(result.extraction).toBeUndefined();
});
```

Add tests for a single failed text-node call yielding a warning and for a Frame with no text yielding `nodes: []`.

- [ ] **Step 2: Run extraction tests to observe RED**

Run:

```bash
npm --workspace @writer/review-core test -- src/figma-extract-mcp.test.ts
```

Expected: failure because `FigmaMcpReader` and `extractFigmaFrameViaMcp` do not exist.

- [ ] **Step 3: Implement typed MCP result and extraction**

Define:

```ts
export type McpCallToolResult = {
  ok: boolean;
  result?: unknown;
  diagnostic?: ConnectionDiagnostic;
};

export interface FigmaMcpReader {
  status: "connected" | "disconnected" | "error";
  getMetadata(scope: FigmaReviewScope): Promise<McpCallToolResult>;
  getDesignContext(fileKey: string, nodeId: string): Promise<McpCallToolResult>;
}
```

Implement `extractFigmaFrameViaMcp()` to read MCP `content[].text`, parse text references and parent paths from metadata XML, call design context per text node, decode actual textual content, build `DesignContext`, and add `partial_read_failure` warnings for omitted nodes. It must not include fallback node text.

- [ ] **Step 4: Verify review-core replacement is green**

Export the new API, remove old stub exports after no callers remain, and run:

```bash
npm --workspace @writer/review-core test
npm run typecheck
```

Expected: extraction fixture tests and existing review-core tests pass.

- [ ] **Step 5: Task checkpoint and Linear synchronization**

Mark OpenSpec tasks `2.1` and `2.2` complete after tests pass. When commits are authorized:

```bash
git add packages/contracts/src/mcp-call.ts packages/contracts/src/index.ts packages/review-core openspec/changes/extract-figma-via-mcp/tasks.md
git commit -m "feat(figma): extract real frame text through MCP"
```

Then mark the extraction-core portion of `WRI-100` in progress with test evidence.

### Task 3: Daemon Audit Integration (`WRI-100`)

**Files:**
- Modify: `apps/daemon/src/mcp-client.ts`
- Modify: `apps/daemon/src/review.ts`
- Modify: `apps/daemon/src/review-queue.ts`
- Modify: `apps/daemon/src/routes/review.ts`
- Modify: `apps/daemon/src/integration.test.ts`

- [ ] **Step 1: Write failing daemon integration tests**

Add an integration state whose connected `figmaClient.callTool()` returns metadata and design context fixtures. Assert:

```ts
expect(await runAuditForFrame()).toMatchObject({
  changes: [{ sourceId: "3:4", before: "Pay now" }]
});
```

Add a disconnected test asserting:

```ts
expect(await runAuditForDisconnectedFrame()).toMatchObject({
  diagnostic: { code: "mcp_not_ready" },
  changes: []
});
```

Also assert that `/sessions/figma` persists `scope.kind === "frame"` directly, not under `suggestedScope`.

- [ ] **Step 2: Run daemon tests to observe RED**

Run:

```bash
npm --workspace @writer/daemon test -- src/integration.test.ts
```

Expected: new tests fail because audit still generates `"Continue"` and `"Click here"` and the session stores nested scope.

- [ ] **Step 3: Implement daemon read adapter and persist extraction**

Move the MCP result type import to `@writer/contracts`. Implement:

```ts
function createFigmaReader(state: DaemonState): FigmaMcpReader {
  return {
    status: state.mcp.figma.status === "connected" && state.mcp.figmaClient ? "connected" : "disconnected",
    getMetadata: (scope) => state.mcp.figmaClient!.callTool("get_metadata", {
      fileKey: scope.fileKey,
      nodeId: scope.nodeId
    }),
    getDesignContext: (fileKey, nodeId) => state.mcp.figmaClient!.callTool("get_design_context", {
      fileKey,
      nodeId
    })
  };
}
```

Make `extractFigmaNodes` asynchronous and accept `state`. Normalize `createFigmaReviewSession` to persist the selected Frame scope. In `runSessionAudit`, call extraction for Figma sessions, update the session with extraction/context/diagnostic, and use:

```ts
const items = extraction.nodes.map((node) => ({
  sourceId: node.id,
  text: node.characters
}));
```

When extraction has a blocking diagnostic, save the session and return an empty queue carrying that diagnostic.

- [ ] **Step 4: Replace remaining stub routes**

Make `/figma/extract` await the MCP-backed extractor and make `/review/context` consume persisted extraction nodes rather than calling a stub. Search for hardcoded Figma text with:

```bash
rg -n '"Continue"|"Click here"|Review your UX copy before publishing|extractFigmaTextNodes|captureDesignContext' apps/daemon packages/review-core
```

Expected: no Figma extraction or audit path retains stub text.

- [ ] **Step 5: Run targeted and type checks**

Run:

```bash
npm --workspace @writer/daemon test -- src/integration.test.ts
npm --workspace @writer/review-core test
npm run typecheck
```

Expected: new extraction/audit integration scenarios pass; address the recorded pre-existing `echo` baseline separately if it still appears.

- [ ] **Step 6: Task checkpoint and Linear synchronization**

Mark OpenSpec tasks `2.3` through `2.5` complete after verification. When commits are authorized:

```bash
git add apps/daemon packages/review-core packages/contracts openspec/changes/extract-figma-via-mcp/tasks.md
git commit -m "feat(figma): run audits from extracted frame text"
```

Then move `WRI-100` to Done and comment with SHA and verification evidence.

### Task 4: Real Permission-Gated Writeback (`WRI-101`)

**Files:**
- Modify: `packages/contracts/src/writeback.ts`
- Modify: `apps/daemon/src/review-queue.ts`
- Modify: `apps/daemon/src/tools.ts`
- Modify: `apps/daemon/src/routes/review.ts`
- Create: `apps/daemon/src/figma-writeback.test.ts`
- Modify: `apps/daemon/src/integration.test.ts`

- [ ] **Step 1: Write failing writeback tests**

Test that approval alone invokes no MCP write, and explicit apply uses original node identity:

```ts
it("writes only approved frame nodes after explicit apply and permission", async () => {
  const result = await runFigmaWriteback(connectedStateWithApprovedPermission, {
    sessionId: "session-1",
    changeIds: ["change-1"]
  });
  expect(calls[0]?.name).toBe("use_figma");
  expect(calls[0]?.args.code).toContain("3:4");
  expect(result.results).toMatchObject([{ sourceId: "3:4", status: "applied" }]);
});

it("does not invoke write MCP without permission", async () => {
  const result = await runFigmaWriteback(stateWithoutPermission, input);
  expect(calls).toEqual([]);
  expect(result.permissionRequestId).toBeTruthy();
});
```

Add tests for `proposed` exclusion, current-text conflict, and mixed per-node applied/failed results.

- [ ] **Step 2: Run writeback tests to observe RED**

Run:

```bash
npm --workspace @writer/daemon test -- src/figma-writeback.test.ts
```

Expected: failures because the current handler only records dry-run applied results and does not invoke MCP.

- [ ] **Step 3: Define accurate writeback response contract**

Extend the result shape to carry permission and diagnostics:

```ts
export const writebackResultSchema = z.object({
  sessionId: z.string().min(1),
  permissionRequestId: z.string().min(1).optional(),
  diagnostic: connectionDiagnosticSchema.optional(),
  results: z.array(writebackItemResultSchema),
  completedAt: z.iso.datetime()
});
```

Use `write_conflict` for changed source text and `write_failed` for MCP execution failures.

- [ ] **Step 4: Implement batch `use_figma` invocation**

Preserve existing daemon permission checks, then invoke MCP only for eligible nodes. Construct a batch operation from validated changes:

```ts
const operations = changes.map((change) => ({
  nodeId: change.sourceId,
  before: change.before,
  after: change.after,
  changeId: change.id
}));

const code = `
const operations = ${JSON.stringify(operations)};
const results = [];
for (const operation of operations) {
  const node = await figma.getNodeByIdAsync(operation.nodeId);
  if (!node || node.type !== "TEXT") {
    results.push({ changeId: operation.changeId, status: "failed", reason: "Text node not found" });
    continue;
  }
  if (node.characters !== operation.before) {
    results.push({ changeId: operation.changeId, status: "failed", reason: "write_conflict" });
    continue;
  }
  const fonts = node.getRangeAllFontNames(0, node.characters.length);
  for (const font of fonts) await figma.loadFontAsync(font);
  node.characters = operation.after;
  results.push({ changeId: operation.changeId, status: "applied" });
}
return results;
`;
```

Call `state.mcp.figmaClient.callTool("use_figma", { fileKey, description, code })`, map returned results back to change transitions, and write an audit-log entry per attempted mutation.

- [ ] **Step 5: Verify apply behavior**

Run:

```bash
npm --workspace @writer/daemon test -- src/figma-writeback.test.ts src/integration.test.ts
npm --workspace @writer/contracts test
npm run typecheck
```

Expected: eligible apply, permission requirement, conflict protection, and partial failure tests pass.

- [ ] **Step 6: Task checkpoint and Linear synchronization**

Mark OpenSpec tasks `3.1` through `3.4` complete only after results are truthful. When commits are authorized:

```bash
git add apps/daemon packages/contracts/src/writeback.ts packages/contracts/src/index.ts openspec/changes/extract-figma-via-mcp/tasks.md
git commit -m "feat(figma): write approved frame copy through MCP"
```

Then move `WRI-101` to Done and attach verification evidence.

### Task 5: Desktop Explicit Apply Workflow (`WRI-102`)

**Files:**
- Modify: `apps/desktop/src/daemon-client.ts`
- Modify: `apps/desktop/src/workspace-context.tsx`
- Modify: `apps/desktop/src/workflow-notification.tsx`
- Modify: `apps/desktop/src/review-queue-panel.tsx`
- Modify: `apps/desktop/src/screens/sources-screen.tsx`
- Modify: `apps/desktop/src/screens/review-screen.tsx`
- Create or modify: `apps/desktop/src/connection-diagnostics.test.ts`
- Create: `apps/desktop/src/review-writeback.test.ts` for pure apply-selection and result-summary helpers used by the UI.

- [ ] **Step 1: Write failing desktop/client behavior tests**

Cover a queue response with `mcp_not_ready`, and writeback handling:

```ts
it("formats MCP-not-ready recovery for a frame audit", () => {
  expect(formatConnectionDiagnostic({
    code: "mcp_not_ready",
    severity: "warning",
    message: "Connect Figma to read this Frame.",
    recoveryAction: "Open Agents and connect Figma."
  })).toContain("Connect Figma");
});
```

Add a test for selecting only `approved` and `edited` changes for apply and one for showing failed write results.

- [ ] **Step 2: Run desktop tests to observe RED**

Run:

```bash
npm --workspace @writer/desktop test
```

Expected: new apply/diagnostic behavior fails because the desktop client has no writeback action or diagnostic-bearing queue model.

- [ ] **Step 3: Implement the explicit apply UI path**

Use shared `ReviewQueue` and `WritebackResult` contracts in `daemon-client.ts`. Add a workspace action:

```ts
async function applyApprovedToFigma(changeIds: string[]) {
  if (!activeSessionId) return;
  const result = await daemonClient.applyFigmaWriteback({ sessionId: activeSessionId, changeIds });
  setWorkflowMessage(summarizeWritebackResult(result));
  await refreshQueue();
}
```

In the queue panel, collect only `approved` or `edited` rows and expose one button labelled `Apply approved to Figma`. Surface a permission-required response as an explicit next action rather than reporting success. In Sources, change parsing copy so it asks for a selected Frame link.

- [ ] **Step 4: Verify desktop workflow**

Run:

```bash
npm --workspace @writer/desktop test
npm run typecheck
```

Expected: desktop tests pass and all typed client calls compile.

- [ ] **Step 5: Task checkpoint**

Mark OpenSpec tasks `4.1` and `4.2` complete. When commits are authorized:

```bash
git add apps/desktop openspec/changes/extract-figma-via-mcp/tasks.md
git commit -m "feat(desktop): apply approved Figma frame copy"
```

Then comment progress on `WRI-102`.

### Task 6: Documentation, Verification, And Closure (`WRI-102`)

**Files:**
- Modify: `README.md`
- Modify: `docs/linear-openspec-map.md`
- Modify: `openspec/changes/extract-figma-via-mcp/tasks.md`
- Create: `openspec/changes/extract-figma-via-mcp/verify.md`
- Create: `openspec/changes/extract-figma-via-mcp/retrospective.md`

- [ ] **Step 1: Update product documentation**

Replace bootstrap limitation text with a Frame workflow note documenting:

```text
Paste a selected Figma design Frame link, run audit to review real text,
approve or edit proposals, then choose Apply approved to Figma to write
confirmed copy back through the connected MCP server.
```

Ensure the Linear map lists `WRI-98` through `WRI-102`.

- [ ] **Step 2: Run automated verification**

Run:

```bash
npm run typecheck
npm run test
openspec validate extract-figma-via-mcp --type change --strict
```

Expected: all pass. If the previously recorded daemon `echo` integration failure remains, record it as blocking unless the user explicitly accepts proceeding with that known baseline.

- [ ] **Step 3: Run manual Frame smoke verification**

Using a connected Figma MCP session and a real selected Frame URL:

```text
1. Create a Figma session and run audit: queue shows real text node content.
2. Approve one proposal: confirm Figma text has not changed.
3. Select Apply approved to Figma and approve permission: confirm only the chosen node changed.
4. Modify another source text in Figma after audit, then apply: confirm Writer reports conflict and does not overwrite it.
5. Disconnect Figma MCP, rerun audit: confirm Connect Figma recovery and no stub output.
```

- [ ] **Step 4: Create verification artifacts**

Invoke `openspec-verify-change` to produce `verify.md` from the executed evidence, then produce `retrospective.md` only when verification has no blocking failure.

- [ ] **Step 5: Final commit and Linear closure after authorization**

When commits are authorized and all evidence passes:

```bash
git add README.md docs/linear-openspec-map.md openspec/changes/extract-figma-via-mcp
git commit -m "docs(opsx): verify Figma frame review and writeback"
```

Move `WRI-102` and parent `WRI-98` to Done with commit SHAs and verification commands, then archive the change according to `superpowers-bridge`.
