# Separate Text and Figma Audit Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the two home cards into independent Text rewrite and Figma Audit workflows while retaining existing conversation, audit-review, and approved-writeback behavior.

**Architecture:** Extend shared contracts with optional Text product context and a read-only Figma batch projection. The daemon owns guideline assembly and batch listing over existing persisted sessions; the renderer introduces dedicated routes that compose the existing chat and review components without moving privileged actions out of the daemon.

**Tech Stack:** TypeScript ESM, Zod, React 19, React Router, Electron, Vitest, npm workspaces.

**Change Artifacts:** `openspec/changes/separate-text-and-figma-audit-workflows/design.md`, `specs/**/*.md`, and `tasks.md`.

**Dependency Note:** `openspec/changes/paste-text-chat-rewrite/` has already implemented the underlying conversation and attachment path. This plan extends that code; it does not add a competing text-chat API.

---

## File Map

- Modify `packages/contracts/src/paste-text.ts` for optional `productId` on Text conversations.
- Modify `packages/contracts/src/review-session.ts` and `packages/contracts/src/index.ts` for Figma Batch Log DTOs and audit-run status metadata.
- Modify `packages/contracts/src/review-session.test.ts`; create or modify `packages/contracts/src/paste-text.test.ts` for contract tests.
- Modify `packages/storage/src/store.ts` and `packages/storage/src/store.test.ts` only for backward-compatible persistence of extended session/conversation shapes.
- Modify `apps/daemon/src/paste-text.ts` and `apps/daemon/src/paste-text.test.ts` for guideline-backed Text rewriting.
- Modify `apps/daemon/src/review.ts`, `apps/daemon/src/review-queue.ts`, and `apps/daemon/src/routes/review.ts`; create `apps/daemon/src/review-batches.test.ts` for Batch listing and status transitions.
- Modify `apps/desktop/src/daemon-client.ts` and `apps/desktop/src/workspace-context.tsx` for Batch load/select actions.
- Create `apps/desktop/src/screens/text-screen.tsx`, `apps/desktop/src/screens/figma-audit-screen.tsx`, and `apps/desktop/src/screens/audit-detail-screen.tsx`.
- Modify `apps/desktop/src/app.tsx`, `apps/desktop/src/screens/home-screen.tsx`, `apps/desktop/src/screens/settings-screen.tsx`, `apps/desktop/src/screens/review-screen.tsx`, and `apps/desktop/src/paste-text-chat-panel.tsx`.
- Modify `README.md`, `PRODUCT.md`, and `DESIGN.md` where they still direct working users to `Sources` or `Review`.

## Task 1: Define Text Context and Audit Batch Contracts

**Files:**
- Modify: `packages/contracts/src/paste-text.ts`
- Modify: `packages/contracts/src/review-session.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/paste-text.test.ts`
- Modify: `packages/contracts/src/review-session.test.ts`

- [ ] **Step 1: Write failing contract tests for optional Text Product context**

Add `packages/contracts/src/paste-text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createPasteTextConversationInputSchema, parsePasteTextConversation } from "./paste-text";

const timestamp = "2026-05-25T12:00:00.000Z";

describe("paste text product context", () => {
  it("allows a conversation without product context", () => {
    expect(createPasteTextConversationInputSchema.parse({ projectId: "proj-1" }).productId).toBeUndefined();
  });

  it("persists an optionally selected product", () => {
    const conversation = parsePasteTextConversation({
      id: "chat-1",
      projectId: "proj-1",
      productId: "checkout",
      inputMode: "plain_text",
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp
    });
    expect(conversation.productId).toBe("checkout");
  });
});
```

- [ ] **Step 2: Write failing Batch Log parser tests**

Append to `packages/contracts/src/review-session.test.ts`:

```ts
import { parseFigmaAuditBatchList } from "./review-session";

it("parses a batch-level Figma audit log entry", () => {
  const list = parseFigmaAuditBatchList({
    batches: [{
      batchId: "sess-figma",
      sessionId: "sess-figma",
      projectId: "proj-1",
      productId: "checkout",
      targetSummary: "Frame 12:34",
      label: "Checkout - Frame 12:34",
      runStatus: "completed",
      createdAt: timestamp,
      updatedAt: timestamp
    }]
  });
  expect(list.batches[0]?.runStatus).toBe("completed");
});
```

- [ ] **Step 3: Run the contract tests and observe the schema failures**

Run:

```bash
npm --workspace @writer/contracts run test -- src/paste-text.test.ts src/review-session.test.ts
```

Expected: FAIL because `productId`, `parseFigmaAuditBatchList`, and the batch schemas do not yet exist.

- [ ] **Step 4: Add minimal Text and Audit Batch Zod shapes**

In `packages/contracts/src/paste-text.ts`, extend both schemas:

```ts
export const pasteTextConversationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  productId: z.string().min(1).optional(),
  backgroundContext: z.string().optional(),
  inputMode: pasteTextInputModeSchema,
  sessionId: z.string().min(1).optional(),
  attachment: pasteTextAttachmentSchema.optional(),
  messages: z.array(pasteTextMessageSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});

export const createPasteTextConversationInputSchema = z.object({
  projectId: z.string().min(1),
  productId: z.string().min(1).optional(),
  backgroundContext: z.string().optional()
});
```

In `packages/contracts/src/review-session.ts`, add independent run metadata instead of overloading approval/review state:

```ts
export const figmaAuditRunStatusSchema = z.enum(["running", "completed", "failed"]);

export const figmaAuditBatchSchema = z.object({
  batchId: z.string().min(1),
  sessionId: z.string().min(1),
  projectId: z.string().min(1),
  productId: z.string().min(1),
  targetSummary: z.string().min(1),
  label: z.string().min(1),
  runStatus: figmaAuditRunStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});

export const figmaAuditBatchListSchema = z.object({
  batches: z.array(figmaAuditBatchSchema)
});

export function parseFigmaAuditBatchList(payload: unknown) {
  return figmaAuditBatchListSchema.parse(payload);
}
```

Extend `reviewSessionSchema` with backward-compatible optional persisted run fields:

```ts
auditRunStatus: figmaAuditRunStatusSchema.optional(),
auditLabel: z.string().min(1).optional(),
```

Export the new schemas, parser, and inferred types from `packages/contracts/src/index.ts`.

- [ ] **Step 5: Run contract tests and typechecking**

Run:

```bash
npm --workspace @writer/contracts run test
npm --workspace @writer/contracts run typecheck
```

Expected: PASS.

- [ ] **Step 6: Record the implementation checkpoint**

When the user authorizes commits, commit only Task 1 files and then update the mapped WRI issue in Linear with the commit SHA and contract summary. Until then, leave the completed task unstaged or staged only at the user's direction.

## Task 2: Persist and Expose Batch-Level Figma Audit History

**Files:**
- Modify: `packages/storage/src/store.test.ts`
- Modify: `apps/daemon/src/review.ts`
- Modify: `apps/daemon/src/review-queue.ts`
- Modify: `apps/daemon/src/routes/review.ts`
- Create: `apps/daemon/src/review-batches.test.ts`

- [ ] **Step 1: Add persistence coverage for optional audit metadata**

Extend the session fixture in `packages/storage/src/store.test.ts`:

```ts
store.upsertSession({
  id: "sess-1",
  projectId: "proj-1",
  productId: "checkout",
  sourceType: "figma",
  scope: { kind: "frame", fileKey: "abc", nodeId: "1:2" },
  status: "reviewing",
  auditRunStatus: "completed",
  auditLabel: "Checkout - Frame 1:2",
  agentRunIds: [],
  createdAt: timestamp,
  updatedAt: timestamp
});

expect(reloaded.listSessions("proj-1").sessions[0]).toMatchObject({
  auditRunStatus: "completed",
  auditLabel: "Checkout - Frame 1:2"
});
```

- [ ] **Step 2: Add daemon tests for one-row-per-Figma-session projection**

Create `apps/daemon/src/review-batches.test.ts` with a test state using
`PlatformStore`, then seed two Figma sessions and one pasted-text session:

```ts
const timestamp = "2026-05-25T12:00:00.000Z";

function figmaSession(id: string, runStatus: "running" | "completed" | "failed") {
  return {
    id,
    projectId: "proj-1",
    productId: "checkout",
    sourceType: "figma" as const,
    scope: { url: "https://www.figma.com/design/file/Example?node-id=12-34", nodeId: "12:34" },
    status: "reviewing" as const,
    auditRunStatus: runStatus,
    auditLabel: "Checkout - Frame 12:34",
    agentRunIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function pastedTextSession(id: string) {
  return {
    id,
    projectId: "proj-1",
    sourceType: "pasted_text" as const,
    scope: { text: "Save" },
    status: "reviewing" as const,
    agentRunIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

it("lists exactly one batch row per figma session", async () => {
  state.store.upsertSession(figmaSession("sess-a", "completed"));
  state.store.upsertSession(figmaSession("sess-b", "failed"));
  state.store.upsertSession(pastedTextSession("chat-session"));

  const result = listFigmaAuditBatches(state, "proj-1");

  expect(result.batches.map((batch) => batch.batchId)).toEqual(["sess-b", "sess-a"]);
  expect(result.batches.map((batch) => batch.runStatus)).toEqual(["failed", "completed"]);
});
```

The fixture contains only session-level records, which proves that the
projection does not flatten findings into table rows.

- [ ] **Step 3: Run storage and daemon tests to verify missing projection behavior**

Run:

```bash
npm --workspace @writer/storage run test -- src/store.test.ts
npm --workspace @writer/daemon run test -- src/review-batches.test.ts
```

Expected: storage persistence test passes because Task 1 introduced the optional
session fields; daemon projection test fails because
`listFigmaAuditBatches` does not yet exist.

- [ ] **Step 4: Implement the read-only Batch projection in the daemon**

In `apps/daemon/src/review.ts`, add a projection with old-session fallbacks:

```ts
export function listFigmaAuditBatches(state: DaemonState, projectId: string | null) {
  const sessions = state.store
    .listSessions(projectId)
    .sessions
    .filter((session) => session.sourceType === "figma");

  return {
    batches: sessions
      .map((session) => {
        const scope = session.scope as Record<string, unknown>;
        const nodeId = String(scope.nodeId ?? "unknown");
        const targetSummary = `Frame ${nodeId}`;
        const runStatus =
          session.auditRunStatus ??
          (session.diagnostic ? "failed" : session.status === "draft" ? "running" : "completed");
        return {
          batchId: session.id,
          sessionId: session.id,
          projectId: session.projectId,
          productId: session.productId!,
          targetSummary,
          label: session.auditLabel ?? targetSummary,
          runStatus,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        };
      })
      .filter((batch) => Boolean(batch.productId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  };
}
```

In `createFigmaReviewSession`, call `createSession`, then upsert the returned
session with `auditRunStatus: "running"` and a deterministic `auditLabel`
after URL parsing so the existing generic create-input contract need not
expose Figma-only fields:

```ts
const session = await createSession(state, {
  projectId: parsed.projectId,
  productId: parsed.productId,
  sourceType: "figma",
  scope: {
    url: parsed.url,
    fileKey: figma.fileKey,
    nodeId: figma.nodeId,
    suggestedScope: figma.suggestedScope
  }
});
const tracked = state.store.upsertSession({
  ...session,
  auditRunStatus: "running",
  auditLabel: `Frame ${figma.nodeId ?? figma.fileKey}`
});
await state.store.save();
return tracked;
```

In `apps/daemon/src/review-queue.ts`, persist `auditRunStatus: "completed"`
after a successful audit and `auditRunStatus: "failed"` before returning an
extraction diagnostic. Wrap failures after the session is found so thrown
extraction/audit errors also update and save the Figma session as failed
before rethrowing; a created Batch must never disappear from history because
execution failed.

- [ ] **Step 5: Add the list route**

Import `listFigmaAuditBatches` into `apps/daemon/src/routes/review.ts` and add:

```ts
if (request.method === "GET" && path === "/figma/audit-batches") {
  const projectId = getQueryParam(request.url, "projectId");
  sendJson(response, 200, listFigmaAuditBatches(state, projectId));
  return true;
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm --workspace @writer/storage run test
npm --workspace @writer/daemon run test -- src/review-batches.test.ts src/figma-writeback.test.ts
npm --workspace @writer/daemon run typecheck
```

Expected: PASS, including unchanged approved-only writeback tests.

- [ ] **Step 7: Record the implementation checkpoint**

After authorization to commit, commit Task 2 files separately and sync its WRI task/comment to Linear with the new commit SHA.

## Task 3: Apply Global and Optional Product Guidelines to Text Rewrite

**Files:**
- Modify: `apps/daemon/src/paste-text.ts`
- Modify: `apps/daemon/src/paste-text.test.ts`

- [ ] **Step 1: Add test fixtures for resolved three-layer guideline data**

In `apps/daemon/src/paste-text.test.ts`, import `setCachedTree` and seed cache
for rewrite tests with mandatory base layers and an optional product:

```ts
function cacheGuidelines() {
  setCachedTree({
    companyBase: {
      status: "ok",
      filePath: "/guidelines/company-base.md",
      contentHash: "company",
      value: { id: "company-base", name: "Company", layer: "company-base", body: "Be direct.", rules: [], glossary: [] }
    },
    softwareWriting: {
      status: "ok",
      filePath: "/guidelines/software-writing.md",
      contentHash: "software",
      value: { id: "software-writing", name: "Software", layer: "software-writing", body: "Use concise labels.", rules: [], glossary: [] }
    },
    products: [],
    errors: [],
    companyBaseMissing: false,
    softwareWritingMissing: false
  });
}
```

Call this fixture at the start of existing successful rewrite tests so the new mandatory rule is intentional.

- [ ] **Step 2: Write failing behavior tests**

Add tests:

```ts
it("rewrites without product while using mandatory global guidelines", async () => {
  cacheGuidelines();
  const conversation = await createPasteTextConversation(state, { projectId: project.id });
  const result = await sendPasteTextMessage(state, conversation.id, { text: "Continue", adapterId: "echo", sync: true });
  expect(result.assistantMessage.status).toBe("complete");
});

it("rejects rewrite when mandatory global guidelines are absent", async () => {
  setCachedTree({ companyBase: null, softwareWriting: null, products: [], errors: [], companyBaseMissing: true, softwareWritingMissing: true });
  const conversation = await createPasteTextConversation(state, { projectId: project.id });
  await expect(sendPasteTextMessage(state, conversation.id, { text: "Continue", adapterId: "echo", sync: true }))
    .rejects.toThrow("Company and software writing guidelines are required");
});

it("rejects an explicitly selected missing product", async () => {
  cacheGuidelines();
  const conversation = await createPasteTextConversation(state, { projectId: project.id, productId: "missing" });
  await expect(sendPasteTextMessage(state, conversation.id, { text: "Continue", adapterId: "echo", sync: true }))
    .rejects.toThrow("Selected product context is unavailable");
});
```

- [ ] **Step 3: Run tests and verify failures**

Run:

```bash
npm --workspace @writer/daemon run test -- src/paste-text.test.ts
```

Expected: FAIL because Text does not yet persist `productId` or inject guideline snapshots.

- [ ] **Step 4: Implement daemon-owned rewrite context assembly**

In `apps/daemon/src/paste-text.ts`, import `injectGuidelineContext` and
`buildGuidelinePromptSection` from `@writer/review-core`, plus guideline
discovery/resolution/snapshot utilities. Add:

```ts
async function buildTextGuidelineContext(
  state: DaemonState,
  conversation: PasteTextConversation,
  userText: string
): Promise<string> {
  const treeResult = getCachedTree() ?? (await discoverGuidelines());
  const tree = buildResolvedTree(treeResult);
  if (tree.companyBaseMissing || tree.softwareWritingMissing || !tree.companyBase || !tree.softwareWriting) {
    throw new Error("Company and software writing guidelines are required before rewriting text.");
  }
  if (conversation.productId && !tree.products.some((product) => product.id === conversation.productId)) {
    throw new Error("Selected product context is unavailable.");
  }
  const snapshot = buildThreeLayerSnapshot(tree, conversation.productId);
  return buildGuidelinePromptSection(injectGuidelineContext(snapshot, "other", userText));
}
```

Persist `parsed.productId` in `createPasteTextConversation`. Before calling
`buildCopywriterPrompt` in `sendPasteTextMessage`, obtain
`guidelineContext` and merge it with freeform screen background:

```ts
const guidelineContext = await buildTextGuidelineContext(state, conversation, parsed.text);
const backgroundContext = [guidelineContext, conversation.backgroundContext].filter(Boolean).join("\n\n");
const prompt = buildCopywriterPrompt({
  backgroundContext,
  brandVoice: getProjectBrandVoice(state, conversation.projectId),
  history: historyFromMessages(conversation.messages),
  userText: parsed.text,
  rowContext
});
```

- [ ] **Step 5: Verify Text tests, including existing CSV attachment behavior**

Run:

```bash
npm --workspace @writer/daemon run test -- src/paste-text.test.ts
npm --workspace @writer/daemon run typecheck
```

Expected: PASS. The existing CSV row rewrite test must still pass with cached global guideline fixtures.

- [ ] **Step 6: Record the implementation checkpoint**

After authorization to commit, commit Task 3 files separately and comment on its mapped Linear task with Text context behavior and verification evidence.

## Task 4: Add Desktop Client and Workspace Batch State

**Files:**
- Modify: `apps/desktop/src/daemon-client.ts`
- Modify: `apps/desktop/src/workspace-context.tsx`

- [ ] **Step 1: Add typecheck-driving client API usage**

Add the Batch list contract import and client method in
`apps/desktop/src/daemon-client.ts`:

```ts
import { parseFigmaAuditBatchList, type FigmaAuditBatchList } from "@writer/contracts";

listFigmaAuditBatches: (projectId: string) =>
  request<FigmaAuditBatchList>(
    baseUrl,
    `/figma/audit-batches?projectId=${encodeURIComponent(projectId)}`,
    undefined,
    parseFigmaAuditBatchList
  ),
```

Run:

```bash
npm --workspace @writer/desktop run typecheck
```

Expected before Task 1 exports are consumed correctly: FAIL on missing imports or return type; after wiring: PASS.

- [ ] **Step 2: Introduce independent audit-list state and selection actions**

In `apps/desktop/src/workspace-context.tsx`, add to `WorkspaceContextValue`:

```ts
auditBatches: FigmaAuditBatch[];
refreshAuditBatches: () => Promise<void>;
openAuditBatch: (batchId: string) => Promise<void>;
```

Implement the state and actions:

```ts
const [auditBatches, setAuditBatches] = useState<FigmaAuditBatch[]>([]);

async function refreshAuditBatches() {
  if (!workspaceProjectId) return;
  const result = await daemonClient.listFigmaAuditBatches(workspaceProjectId);
  setAuditBatches(result.batches);
}

async function openAuditBatch(batchId: string) {
  setActiveSessionId(batchId);
  const queue = await daemonClient.getReviewQueue(batchId);
  setReviewQueue(queue);
}
```

After `runFigmaAudit()` finishes (successful or diagnosed failed run), call
`refreshAuditBatches()` rather than navigating away from the list page.

- [ ] **Step 3: Verify desktop types**

Run:

```bash
npm --workspace @writer/desktop run typecheck
```

Expected: PASS.

- [ ] **Step 4: Record the implementation checkpoint**

After authorization to commit, commit the client/context changes and sync the corresponding Linear issue/comment.

## Task 5: Build the Standalone Text Workflow

**Files:**
- Create: `apps/desktop/src/screens/text-screen.tsx`
- Modify: `apps/desktop/src/paste-text-chat-panel.tsx`
- Modify: `apps/desktop/src/app.tsx`

- [ ] **Step 1: Refactor Text selection to be local and optional**

In `apps/desktop/src/paste-text-chat-panel.tsx`, keep the workspace project and
product list but replace the implicit required shared selection with local
selection:

```tsx
const { workspaceProjectId, workspaceReady, products } = useWorkspace();
const [textProductId, setTextProductId] = useState<string>("");

const created = await client.createPasteTextConversation({
  projectId: workspaceProjectId,
  productId: textProductId || undefined,
  backgroundContext: backgroundContext.trim() || undefined
});
```

Remove `!selectedProductId` from `handleSend`, textarea, and Send-button
disabled conditions. Replace the old "Select a product" alert with:

```tsx
<Select value={textProductId} onValueChange={setTextProductId} disabled={Boolean(conversation)}>
  <SelectTrigger aria-label="Product context">
    <SelectValue placeholder="No product context" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">No product context</SelectItem>
    {products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}
  </SelectContent>
</Select>
```

If the Select component does not accept an empty item, use an explicit
sentinel value `"none"` and translate it to `undefined` at request time.

- [ ] **Step 2: Create a focused Text route wrapper**

Add `apps/desktop/src/screens/text-screen.tsx`:

```tsx
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PasteTextChatPanel } from "../paste-text-chat-panel";
import { useWorkspace } from "../workspace-context";

export function TextScreen() {
  const navigate = useNavigate();
  const workspace = useWorkspace();
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <button type="button" onClick={() => navigate("/")} aria-label="Back to home">
        <ArrowLeft className="size-4" aria-hidden /> Back
      </button>
      <PasteTextChatPanel client={workspace.daemonClient} daemonConnected={workspace.daemonConnected} />
    </div>
  );
}
```

Apply the same existing Back-button classes used by `settings-screen.tsx`.

- [ ] **Step 3: Register `/text` and verify existing attachment UI remains reachable**

In `apps/desktop/src/app.tsx`, import `TextScreen` and add:

```tsx
<Route path="/text" element={<TextScreen />} />
```

Run:

```bash
npm --workspace @writer/desktop run typecheck
```

Expected: PASS. Manual check later must confirm the paperclip attachment flow
is still displayed on `/text`.

- [ ] **Step 4: Record the implementation checkpoint**

After authorization to commit, commit Text route/UI changes and sync the mapped Linear issue/comment.

## Task 6: Build the Figma Audit Log and Audit Detail Workflows

**Files:**
- Create: `apps/desktop/src/screens/figma-audit-screen.tsx`
- Create: `apps/desktop/src/screens/audit-detail-screen.tsx`
- Modify: `apps/desktop/src/screens/review-screen.tsx`
- Modify: `apps/desktop/src/app.tsx`

- [ ] **Step 1: Create the Audit Log page from the current Figma intake form**

Move the Figma form behavior currently in `sources-screen.tsx` into
`apps/desktop/src/screens/figma-audit-screen.tsx`. Keep required Product and
URL validation, remove Text composition, and render one row per
`workspace.auditBatches`:

```tsx
{workspace.auditBatches.map((batch) => (
  <button key={batch.batchId} type="button" onClick={() => navigate(`/figma-audit/${batch.batchId}`)}>
    <span>{workspace.products.find((product) => product.id === batch.productId)?.name ?? batch.productId}</span>
    <span>{batch.targetSummary}</span>
    <span>{batch.batchId.slice(0, 8)}</span>
    <span>{batch.label}</span>
    <span>{batch.runStatus}</span>
    <time dateTime={batch.updatedAt}>{new Date(batch.updatedAt).toLocaleString()}</time>
  </button>
))}
```

Use the project's existing card/grid/typography components and add Back
navigation to `/`. Call `refreshAuditBatches()` once the page is ready and
after `runFigmaAudit()` returns.

- [ ] **Step 2: Create the Batch-keyed Audit Detail wrapper**

Add `apps/desktop/src/screens/audit-detail-screen.tsx`:

```tsx
import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ReviewScreen } from "./review-screen";
import { useWorkspace } from "../workspace-context";

export function AuditDetailScreen() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const workspace = useWorkspace();

  useEffect(() => {
    if (batchId) void workspace.openAuditBatch(batchId);
  }, [batchId]);

  if (!batchId) return <Navigate to="/figma-audit" replace />;
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <button type="button" onClick={() => navigate("/figma-audit")}>Back to audit log</button>
      <ReviewScreen />
    </div>
  );
}
```

Use the established Back-button style and change stale `Sources` empty-state
link in `review-screen.tsx` to `/figma-audit`.

- [ ] **Step 3: Register routes**

In `apps/desktop/src/app.tsx`, add:

```tsx
<Route path="/figma-audit" element={<FigmaAuditScreen />} />
<Route path="/figma-audit/:batchId" element={<AuditDetailScreen />} />
```

- [ ] **Step 4: Verify the route composition typechecks**

Run:

```bash
npm --workspace @writer/desktop run typecheck
```

Expected: PASS. The detail page continues to call only existing daemon-client
methods for approval/export/writeback.

- [ ] **Step 5: Record the implementation checkpoint**

After authorization to commit, commit Audit Log/Detail route changes and sync the mapped Linear issue/comment.

## Task 7: Remove Settings Work Tabs and Update Home Navigation

**Files:**
- Modify: `apps/desktop/src/screens/home-screen.tsx`
- Modify: `apps/desktop/src/screens/settings-screen.tsx`
- Delete if unused after imports are removed: `apps/desktop/src/screens/sources-screen.tsx`

- [ ] **Step 1: Point the home cards at workflow routes**

Update `apps/desktop/src/screens/home-screen.tsx`:

```tsx
<WorkflowCard type="Figma" label="Audit" onClick={() => navigate("/figma-audit")} />
<WorkflowCard type="Text" label="Rewrite" onClick={() => navigate("/text")} />
```

- [ ] **Step 2: Restrict Settings to actual configuration**

Update `apps/desktop/src/screens/settings-screen.tsx`:

```ts
const SETTINGS_TABS = ["guidelines", "agents"] as const;
const defaultTab =
  fromQuery && (SETTINGS_TABS as readonly string[]).includes(fromQuery) ? fromQuery : "guidelines";
```

Remove `ReviewScreen`, `SourcesScreen`, their triggers, and their content
blocks. Remove `sources-screen.tsx` only after `rg "SourcesScreen"` confirms
no import remains.

- [ ] **Step 3: Locate and update stale links/copy**

Run:

```bash
rg -n 'Sources|Review|/settings\\?tab=(review|sources)|/figma' apps/desktop/src README.md PRODUCT.md DESIGN.md
```

Replace user instructions that refer to work execution via old Settings tabs
with `/text`, `/figma-audit`, or Audit Detail terminology. Keep technical
mentions of review queue types where they describe code, not navigation.

- [ ] **Step 4: Verify desktop typechecking**

Run:

```bash
npm --workspace @writer/desktop run typecheck
```

Expected: PASS with no imports from deleted workflow tabs in Settings.

- [ ] **Step 5: Record the implementation checkpoint**

After authorization to commit, commit navigation/docs cleanup and update the mapped Linear issue/comment.

## Task 8: Full Validation and Manual Workflow Evidence

**Files:**
- Modify as needed: tests introduced in Tasks 1-3
- Modify: `openspec/changes/separate-text-and-figma-audit-workflows/tasks.md` only as implementation tasks complete
- Later create through `/opsx:verify`: `openspec/changes/separate-text-and-figma-audit-workflows/verify.md`

- [ ] **Step 1: Validate OpenSpec artifacts before implementing**

Run:

```bash
openspec validate separate-text-and-figma-audit-workflows --type change --strict --no-interactive
```

Expected: valid change artifacts.

- [ ] **Step 2: Run all automated verification after implementation**

Run:

```bash
npm run typecheck
npm run test
```

Expected: PASS in all workspaces.

- [ ] **Step 3: Perform Text workflow smoke checks**

Run the desktop app with the local daemon and verify:

1. Home `Text` opens `/text` and Back returns home.
2. With no Product selected, pasted text rewrites successfully using global configuration.
3. With a Product selected, pasted text rewrites with product context or surfaces a readable product-context failure.
4. CSV/XLSX attachment remains available in Text and does not add a Figma Audit Log row.

Expected: each case matches `specs/text-rewrite-workflow/spec.md`.

- [ ] **Step 4: Perform Figma Audit workflow smoke checks**

Verify:

1. Home `Figma Audit` opens the Audit Log page and Back returns home.
2. Settings displays Guidelines and Agents but not Review or Sources.
3. A valid Product plus Figma URL creates exactly one Batch row with Product, target, Batch, Label, status, and time.
4. Selecting the row opens Audit Detail, and returning preserves the list.
5. An approved change follows the existing permission-gated writeback path; an unapproved change cannot write back.

Expected: each case matches the desktop-shell and review-session-storage delta specs.

- [ ] **Step 5: Complete governed execution records**

As each implementation task is committed with user authorization, check it
off in `tasks.md` and update its mapped WRI issue state plus comment with the
commit SHA and shipped behavior. After all tasks and tests are complete, run
`/opsx:verify` to create `verify.md` and capture the manual evidence above.
