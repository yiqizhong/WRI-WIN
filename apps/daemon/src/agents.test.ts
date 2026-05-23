import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { describe, expect, it } from "vitest";

import { getAgentAdapterList, startAgentRun } from "./agents";
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
  it("lists adapters from registry including echo", async () => {
    const state = await createTestState();
    const list = await getAgentAdapterList(state);
    const echo = list.adapters.find((adapter) => adapter.id === "echo");

    expect(echo).toBeDefined();
    expect(echo?.available).toBe(true);
    expect(list.activeAdapterId).toBe("echo");
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
