import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getPasteTextParseResultPath, PlatformStore } from "@writer/storage";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { invalidateCache, setCachedTree } from "./guidelines/cache";
import { discoverGuidelines } from "./guidelines/discovery";
import { registerImporter } from "./guidelines/importers/index";
import { MarkdownImporter } from "./guidelines/importers/markdown-importer";
import {
  attachPasteTextFile,
  createPasteTextConversation,
  getPasteTextConversation,
  sendPasteTextMessage
} from "./paste-text";
import { createProject } from "./state";
import type { DaemonState } from "./state";

registerImporter(new MarkdownImporter());

const PRODUCT_BACKGROUND_MD = `---
id: checkout
name: Checkout
audience: Shoppers
environment: Web
purpose: Complete purchase
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

Product context body.
`;

const PRODUCT_WRITING_GUIDE_MD = `---
id: checkout-guide
name: Checkout Writing Guide
layer: product-writing
productId: checkout
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

Use short labels on buttons.
`;

let guidelinesDir: string;

async function createTestState(): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-paste-text-"));
  const store = new PlatformStore({ dataDir });
  await store.load();

  return {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: {
      figma: {
        id: "figma",
        name: "Figma MCP",
        enabled: false,
        status: "disconnected",
        capabilities: ["figma.read", "figma.write"]
      }
    }
  };
}

async function seedGuidelinesTree(): Promise<void> {
  const productDir = join(guidelinesDir, "products", "checkout");
  await mkdir(productDir, { recursive: true });
  await writeFile(join(guidelinesDir, "company-base.md"), `---
id: company-base
name: Company Base
layer: company-base
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

Brand voice prose.
`);
  await writeFile(join(guidelinesDir, "software-writing.md"), `---
id: software-writing
name: Software Writing
layer: software-writing
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

Keep button labels short.
`);
  await writeFile(join(productDir, "background.md"), PRODUCT_BACKGROUND_MD);
  await writeFile(join(productDir, "writing-guide.md"), PRODUCT_WRITING_GUIDE_MD);

  const tree = await discoverGuidelines(guidelinesDir);
  setCachedTree(tree);
}

beforeEach(async () => {
  guidelinesDir = join(tmpdir(), `writer-paste-guidelines-${Date.now()}`);
  await mkdir(guidelinesDir, { recursive: true });
  invalidateCache();
});

afterEach(async () => {
  invalidateCache();
  await rm(guidelinesDir, { recursive: true, force: true });
});

describe("paste-text conversations", () => {
  it("creates conversation with productId and guideline snapshot", async () => {
    await seedGuidelinesTree();
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });

    const conversation = await createPasteTextConversation(state, {
      projectId: project.id,
      productId: "checkout",
      backgroundContext: "Checkout flow, friendly tone"
    });

    expect(conversation.id).toBeTruthy();
    expect(conversation.productId).toBe("checkout");
    expect(conversation.guidelineSnapshot?.companyBase?.content).toContain("Brand voice");
    expect(conversation.guidelineSnapshot?.softwareWriting?.content).toContain("button labels");
    expect(conversation.guidelineSnapshot?.productGuideline?.content).toContain("Product context");
    expect(conversation.backgroundContext).toBe("Checkout flow, friendly tone");
    expect(conversation.inputMode).toBe("plain_text");
    expect(conversation.messages).toHaveLength(0);
  });

  it("creates conversation without productId using company and software layers only", async () => {
    await seedGuidelinesTree();
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });

    const conversation = await createPasteTextConversation(state, {
      projectId: project.id
    });

    expect(conversation.productId).toBeUndefined();
    expect(conversation.guidelineSnapshot?.companyBase?.content).toContain("Brand voice");
    expect(conversation.guidelineSnapshot?.softwareWriting?.content).toContain("button labels");
    expect(conversation.guidelineSnapshot?.productGuideline).toBeUndefined();
  });

  it("rejects create with unknown productId", async () => {
    await seedGuidelinesTree();
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });

    await expect(
      createPasteTextConversation(state, {
        projectId: project.id,
        productId: "missing-product"
      })
    ).rejects.toThrow(/Unknown productId/);
  });

  it("creates without product when guidelines tree has zero products", async () => {
    await writeFile(join(guidelinesDir, "company-base.md"), `---
id: company-base
name: Company Base
layer: company-base
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

Brand only.
`);
    setCachedTree(await discoverGuidelines(guidelinesDir));

    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });

    const conversation = await createPasteTextConversation(state, {
      projectId: project.id
    });

    expect(conversation.productId).toBeUndefined();
    expect(conversation.guidelineSnapshot?.companyBase?.content).toContain("Brand only");
    expect(conversation.guidelineSnapshot?.productGuideline).toBeUndefined();
  });

  it("sends message and returns assistant rewrite via echo adapter", async () => {
    await seedGuidelinesTree();
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });

    const conversation = await createPasteTextConversation(state, {
      projectId: project.id,
      productId: "checkout",
      backgroundContext: "Settings page"
    });

    const result = await sendPasteTextMessage(state, conversation.id, {
      text: "Click here to save your stuff",
      adapterId: "echo",
      sync: true
    });

    expect(result.userMessage.text).toBe("Click here to save your stuff");
    expect(result.assistantMessage.suggestedText).toBeTruthy();
    expect(result.conversation.sessionId).toBeTruthy();
    expect(result.conversation.messages).toHaveLength(2);

    const reloaded = getPasteTextConversation(state, conversation.id);
    expect(reloaded.messages).toHaveLength(2);
  });

  it("attaches csv and rewrites a spreadsheet row", async () => {
    await seedGuidelinesTree();
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });
    const dataDir = state.store.dataDir;
    const csvPath = join(dataDir, "copy.csv");
    await writeFile(csvPath, "source,suggestion\nClick here,Save changes\n", "utf8");

    const conversation = await createPasteTextConversation(state, {
      projectId: project.id,
      productId: "checkout",
      backgroundContext: "Product UI"
    });

    const withAttachment = await attachPasteTextFile(state, {
      conversationId: conversation.id,
      filePath: csvPath
    });

    expect(withAttachment.inputMode).toBe("structured_file");
    expect(withAttachment.attachment?.mimeKind).toBe("spreadsheet");
    expect(withAttachment.attachment?.parseResult).toBeUndefined();
    expect(withAttachment.attachment?.parseResultPath).toBe(
      getPasteTextParseResultPath(dataDir, conversation.id)
    );
    await access(withAttachment.attachment!.parseResultPath!);
    const onDisk = JSON.parse(
      await readFile(withAttachment.attachment!.parseResultPath!, "utf8")
    ) as { rows: unknown[] };
    expect(onDisk.rows.length).toBeGreaterThan(0);

    const rawStore = JSON.parse(await readFile(join(dataDir, "platform-store.json"), "utf8")) as {
      pasteTextConversations: Array<{ attachment?: { parseResult?: unknown } }>;
    };
    expect(rawStore.pasteTextConversations[0]?.attachment?.parseResult).toBeUndefined();

    const result = await sendPasteTextMessage(state, conversation.id, {
      text: "Click here",
      rowIndex: 0,
      adapterId: "echo",
      sync: true
    });

    expect(result.assistantMessage.suggestedText).toBeTruthy();
  });

  it("returns immediately with pending assistant message when async", async () => {
    await seedGuidelinesTree();
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });

    const conversation = await createPasteTextConversation(state, {
      projectId: project.id,
      productId: "checkout"
    });

    const result = await sendPasteTextMessage(state, conversation.id, {
      text: "Click here",
      adapterId: "echo"
    });

    expect(result.assistantMessage.status).toBe("pending");
    expect(result.assistantMessage.agentRunId).toBeTruthy();
    expect(result.conversation.messages).toHaveLength(2);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const withRun = getPasteTextConversation(state, conversation.id);
    const pendingAssistant = withRun.messages.find((message) => message.role === "assistant");
    expect(pendingAssistant?.agentRunId).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 2_500));

    const reloaded = getPasteTextConversation(state, conversation.id);
    const assistant = reloaded.messages.find((message) => message.role === "assistant");
    expect(assistant?.status).toBe("complete");
    expect(assistant?.suggestedText).toBeTruthy();
  });
});
