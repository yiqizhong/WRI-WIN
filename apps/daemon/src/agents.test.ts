import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { describe, expect, it } from "vitest";

import { getAgentAdapterList, setActiveAdapter, smokeAgentAdapter, startAgentRun } from "./agents";
import { createProject, createSession } from "./state";
import type { DaemonState } from "./state";

async function createTestState(): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-agents-"));
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

describe("agent discovery and runs", () => {
  it("lists known adapters (LLM providers and local models)", async () => {
    const state = await createTestState();
    const list = await getAgentAdapterList(state);

    const knownIds = new Set(["cursor-agent", "devin", "local-gemma"]);
    expect(list.adapters.every((adapter) => knownIds.has(adapter.id))).toBe(true);
    expect(list.adapters.some((adapter) => adapter.id === "cursor-agent")).toBe(true);
    expect(list.adapters.some((adapter) => adapter.id === "devin")).toBe(true);
    expect(list.adapters.some((adapter) => adapter.id === "local-gemma")).toBe(true);
    expect(list.adapters.some((adapter) => adapter.id === "claude-code")).toBe(false);
    expect(list.adapters.some((adapter) => adapter.id === "codex")).toBe(false);
    expect(list.adapters.some((adapter) => adapter.id === "echo")).toBe(false);
    expect(list.activeAdapterId).toBeTruthy();
  });

  it("persists active adapter across reload", async () => {
    const state = await createTestState();
    await setActiveAdapter(state, { adapterId: "devin" });

    const reloadedStore = new PlatformStore({ dataDir: state.store.dataDir });
    await reloadedStore.load();
    const list = await getAgentAdapterList({ ...state, store: reloadedStore });

    expect(list.activeAdapterId).toBe("devin");
  });

  it("rejects smoke for unknown adapter", async () => {
    const state = await createTestState();

    await expect(smokeAgentAdapter(state, { adapterId: "unknown-adapter" })).rejects.toThrow(
      /Unknown or unsupported/
    );
  });

  it("runs echo adapter and persists events", async () => {
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });
    const session = await createSession(state, {
      projectId: project.id,
      sourceType: "figma",
      scope: { kind: "file", fileKey: "abc" }
    });

    const result = await startAgentRun(state, {
      sessionId: session.id,
      adapterId: "echo",
      prompt: "hello-writer"
    });

    expect(result.run.status).toBe("completed");
    expect(result.events.some((event) => event.type === "text")).toBe(true);
    expect(state.store.getAgentRun(result.run.id)?.status).toBe("completed");
  });
});
