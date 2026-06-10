import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { describe, expect, it } from "vitest";

import { startAgentRun } from "./agents";
import { createProject, createSession } from "./state";
import type { DaemonState } from "./state";

async function createTestState(): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-agents-gate-"));
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

describe("agent run adapter gate", () => {
  it("refuses to run a request-supplied non-known adapter (echo) even with a valid session", async () => {
    // The `echo` dev adapter is registered but is NOT a known/selectable
    // adapter. A POST /agents/runs with adapterId:"echo" must be rejected at
    // resolution time so it never reaches the echo spawn (cmd.exe RCE vector).
    const state = await createTestState();
    const project = await createProject(state, { name: "Demo", rootPath: "/tmp/demo" });
    const session = await createSession(state, {
      projectId: project.id,
      sourceType: "figma",
      scope: { kind: "file", fileKey: "abc" }
    });

    await expect(
      startAgentRun(state, {
        sessionId: session.id,
        adapterId: "echo",
        prompt: "x"
      })
    ).rejects.toThrow(/not selectable/i);

    // The run must never have been recorded — proof the spawn was not reached.
    expect(state.activeRuns.size).toBe(0);
  });
});
