import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { describe, expect, it } from "vitest";

import {
  attachPasteTextFile,
  createPasteTextConversation,
  getPasteTextConversation,
  sendPasteTextMessage
} from "./paste-text";
import { createProject } from "./state";
import type { DaemonState } from "./state";

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

describe("paste-text conversations", () => {
  it("creates conversation with background context", async () => {
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });

    const conversation = await createPasteTextConversation(state, {
      projectId: project.id,
      backgroundContext: "Checkout flow, friendly tone"
    });

    expect(conversation.id).toBeTruthy();
    expect(conversation.backgroundContext).toBe("Checkout flow, friendly tone");
    expect(conversation.inputMode).toBe("plain_text");
    expect(conversation.messages).toHaveLength(0);
  });

  it("sends message and returns assistant rewrite via echo adapter", async () => {
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });

    const conversation = await createPasteTextConversation(state, {
      projectId: project.id,
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
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });
    const dataDir = state.store.dataDir;
    const csvPath = join(dataDir, "copy.csv");
    await writeFile(csvPath, "source,suggestion\nClick here,Save changes\n", "utf8");

    const conversation = await createPasteTextConversation(state, {
      projectId: project.id,
      backgroundContext: "Product UI"
    });

    const withAttachment = await attachPasteTextFile(state, {
      conversationId: conversation.id,
      filePath: csvPath
    });

    expect(withAttachment.inputMode).toBe("structured_file");
    expect(withAttachment.attachment?.mimeKind).toBe("spreadsheet");

    const result = await sendPasteTextMessage(state, conversation.id, {
      text: "Click here",
      rowIndex: 0,
      adapterId: "echo",
      sync: true
    });

    expect(result.assistantMessage.suggestedText).toBeTruthy();
  });

  it("returns immediately with pending assistant message when async", async () => {
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });

    const conversation = await createPasteTextConversation(state, {
      projectId: project.id
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
