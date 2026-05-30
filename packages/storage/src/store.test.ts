import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getPasteTextParseResultPath } from "./paste-text-paths";
import { AUDIT_LOG_CAP, PlatformStore, STORAGE_VERSION } from "./store";

describe("PlatformStore", () => {
  it("persists projects across reload", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    const store = new PlatformStore({ dataDir });

    const timestamp = new Date().toISOString();
    store.upsertProject({
      id: "proj-1",
      name: "Writer",
      rootPath: "/tmp/writer",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await store.save();

    const reloaded = new PlatformStore({ dataDir });
    await reloaded.load();

    const projects = reloaded.listProjects();
    expect(projects.activeProjectId).toBe("proj-1");
    expect(projects.projects[0]?.name).toBe("Writer");
  });

  it("persists activeProductId and drops legacy activeGuidelineId on load", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    const store = new PlatformStore({ dataDir });
    await store.load();

    const timestamp = new Date().toISOString();
    store.upsertProject({
      id: "proj-1",
      name: "Writer",
      rootPath: "/tmp/writer",
      activeProductId: "checkout",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await store.save();

    await writeFile(
      join(dataDir, "platform-store.json"),
      JSON.stringify(
        {
          version: STORAGE_VERSION,
          projects: [
            {
              id: "proj-legacy",
              name: "Legacy",
              rootPath: "/tmp/legacy",
              activeGuidelineId: "old-guideline",
              activeProductId: "checkout",
              createdAt: timestamp,
              updatedAt: timestamp
            }
          ],
          activeProjectId: "proj-legacy",
          sessions: [],
          auditLog: []
        },
        null,
        2
      ),
      "utf8"
    );

    const reloaded = new PlatformStore({ dataDir });
    await reloaded.load();
    const project = reloaded.listProjects().projects[0];
    expect(project?.activeProductId).toBe("checkout");
    expect(project).not.toHaveProperty("activeGuidelineId");

    reloaded.setActiveProductId("proj-legacy", null);
    expect(reloaded.getActiveProductId("proj-legacy")).toBeNull();
    reloaded.setActiveProductId("proj-legacy", "billing");
    expect(reloaded.getActiveProductId("proj-legacy")).toBe("billing");
  });

  it("persists review sessions across reload", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    const store = new PlatformStore({ dataDir });
    await store.load();

    const timestamp = new Date().toISOString();
    store.upsertProject({
      id: "proj-1",
      name: "Writer",
      rootPath: "/tmp/writer",
      createdAt: timestamp,
      updatedAt: timestamp
    });
    store.upsertSession({
      id: "sess-1",
      projectId: "proj-1",
      sourceType: "figma",
      scope: { kind: "frame", fileKey: "abc", nodeId: "1:2" },
      status: "draft",
      agentRunIds: [],
      figmaExtraction: {
        scope: { kind: "frame", fileKey: "abc", nodeId: "1:2" },
        nodes: [
          {
            id: "3:4",
            name: "CTA",
            path: ["Checkout", "CTA"],
            characters: "Pay now",
            visible: true
          }
        ],
        warnings: [],
        extractedAt: timestamp
      },
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await store.save();

    const reloaded = new PlatformStore({ dataDir });
    await reloaded.load();

    const sessions = reloaded.listSessions("proj-1");
    expect(sessions.sessions[0]?.id).toBe("sess-1");
    expect(sessions.sessions[0]?.figmaExtraction?.nodes[0]).toMatchObject({
      id: "3:4",
      characters: "Pay now"
    });
  });

  it("purges agent run events for a run id", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    const store = new PlatformStore({ dataDir });
    await store.load();

    const timestamp = new Date().toISOString();
    store.upsertAgentRun({
      id: "run-1",
      sessionId: "sess-1",
      adapterId: "echo",
      status: "completed",
      startedAt: timestamp,
      endedAt: timestamp
    });
    store.appendAgentRunEvent({
      id: "evt-1",
      runId: "run-1",
      type: "text",
      timestamp,
      payload: { text: "hello" }
    });
    store.appendAgentRunEvent({
      id: "evt-2",
      runId: "run-2",
      type: "text",
      timestamp,
      payload: { text: "other" }
    });

    store.purgeAgentRunEvents("run-1");

    expect(store.listAgentRunEvents("run-1")).toHaveLength(0);
    expect(store.listAgentRunEvents("run-2")).toHaveLength(1);
  });

  it("caps audit log at AUDIT_LOG_CAP", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    const store = new PlatformStore({ dataDir });
    await store.load();

    const timestamp = new Date().toISOString();
    for (let index = 0; index < AUDIT_LOG_CAP + 5; index += 1) {
      store.appendAuditEntry({
        type: "agent_run_lifecycle",
        actor: "agent",
        summary: `run-${index}`,
        timestamp,
        details: { runId: `run-${index}` }
      });
    }

    expect(store.listAuditLog().entries).toHaveLength(AUDIT_LOG_CAP);
    expect(store.listAuditLog().entries[0]?.summary).toBe("run-5");
  });

  it("migrates inline parseResult to disk on load", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    const timestamp = new Date().toISOString();
    const conversationId = "conv-migrate";
    const parseResult = {
      columns: [{ index: 0, header: "source" }],
      rows: [{ index: 0, cells: { "0": "Click here" } }]
    };

    await mkdir(join(dataDir, "conversations"), { recursive: true });
    await writeFile(
      join(dataDir, "platform-store.json"),
      JSON.stringify(
        {
          version: STORAGE_VERSION,
          projects: [],
          activeProjectId: null,
          sessions: [],
          auditLog: [],
          agentRuns: [],
          agentRunEvents: [],
          activeAdapterId: null,
          reviewChanges: [],
          findings: [],
          rewrites: [],
          pasteTextConversations: [
            {
              id: conversationId,
              projectId: "proj-1",
              inputMode: "structured_file",
              attachment: {
                id: "att-1",
                fileName: "copy.csv",
                filePath: "/tmp/copy.csv",
                mimeKind: "spreadsheet",
                parseResult,
                createdAt: timestamp
              },
              messages: [],
              createdAt: timestamp,
              updatedAt: timestamp
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const store = new PlatformStore({ dataDir });
    await store.load();

    const conversation = store.getPasteTextConversation(conversationId);
    const parseResultPath = getPasteTextParseResultPath(dataDir, conversationId);
    expect(conversation?.attachment?.parseResult).toBeUndefined();
    expect(conversation?.attachment?.parseResultPath).toBe(parseResultPath);
    await access(parseResultPath);
    const onDisk = JSON.parse(await readFile(parseResultPath, "utf8"));
    expect(onDisk).toEqual(parseResult);

    const raw = JSON.parse(await readFile(join(dataDir, "platform-store.json"), "utf8")) as {
      pasteTextConversations: Array<{ attachment?: { parseResult?: unknown } }>;
    };
    expect(raw.pasteTextConversations[0]?.attachment?.parseResult).toBeUndefined();
  });

  it("purges agent run events for terminal runs on load", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    const timestamp = new Date().toISOString();

    await writeFile(
      join(dataDir, "platform-store.json"),
      JSON.stringify(
        {
          version: STORAGE_VERSION,
          projects: [],
          activeProjectId: null,
          sessions: [],
          auditLog: [],
          agentRuns: [
            {
              id: "run-done",
              sessionId: "sess-1",
              adapterId: "echo",
              status: "completed",
              startedAt: timestamp,
              endedAt: timestamp
            }
          ],
          agentRunEvents: [
            {
              id: "evt-done",
              runId: "run-done",
              type: "text",
              timestamp,
              payload: { text: "done" }
            }
          ],
          activeAdapterId: null,
          reviewChanges: [],
          findings: [],
          rewrites: [],
          pasteTextConversations: []
        },
        null,
        2
      ),
      "utf8"
    );

    const store = new PlatformStore({ dataDir });
    await store.load();

    expect(store.listAgentRunEvents("run-done")).toHaveLength(0);
  });

  it("writes the storage version into new files", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    const store = new PlatformStore({ dataDir });
    await store.load();
    await store.save();

    const reloaded = new PlatformStore({ dataDir });
    await reloaded.load();

    expect(reloaded.listProjects().projects).toEqual([]);
    expect(STORAGE_VERSION).toBe(1);
  });
});

describe("speculativeDecoding slice", () => {
  it("defaults to { enabled: false } on a fresh store", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    const store = new PlatformStore({ dataDir });
    await store.load();
    expect(store.getSpeculativeDecoding()).toEqual({ enabled: false });
  });

  it("persists enabled and lastError across reload", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    const store = new PlatformStore({ dataDir });
    await store.load();
    store.setSpeculativeDecoding({ enabled: true, lastError: "vram" });
    await store.save();

    const reloaded = new PlatformStore({ dataDir });
    await reloaded.load();
    expect(reloaded.getSpeculativeDecoding()).toEqual({ enabled: true, lastError: "vram" });
  });

  it("migrates a snapshot lacking the slice to the default", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-store-"));
    // Write a legacy snapshot without speculativeDecoding
    await writeFile(
      join(dataDir, "platform-store.json"),
      JSON.stringify({
        version: 1,
        projects: [],
        activeProjectId: null,
        sessions: [],
        auditLog: [],
        agentRuns: [],
        agentRunEvents: [],
        activeAdapterId: null,
        reviewChanges: [],
        findings: [],
        rewrites: [],
        pasteTextConversations: [],
        localModel: null
      }),
      "utf8"
    );
    const store = new PlatformStore({ dataDir });
    await store.load();
    expect(store.getSpeculativeDecoding()).toEqual({ enabled: false });
  });
});
