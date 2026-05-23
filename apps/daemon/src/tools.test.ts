import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { describe, expect, it } from "vitest";

import { createDefaultMcpState } from "./mcp";
import { seedDemoChange } from "./review";
import { createPermissionRequest, executeTool } from "./tools";
import type { DaemonState } from "./state";

async function createTestState(): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-tools-"));
  const store = new PlatformStore({ dataDir });
  await store.load();

  return {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: createDefaultMcpState()
  };
}

describe("write tool gates", () => {
  it("blocks figma.write without approved change id", async () => {
    const state = await createTestState();
    const result = await executeTool(state, {
      toolId: "figma.write",
      sessionId: "sess-1"
    });

    expect(result.ok).toBe(false);
    expect(result.output).toMatchObject({ message: expect.stringContaining("change ID") });
  });

  it("allows figma.write when change is approved", async () => {
    const state = await createTestState();
    const change = await seedDemoChange(state, "sess-1");

    const request = await createPermissionRequest(state, {
      toolId: "figma.write",
      sessionId: "sess-1",
      reason: "Smoke write"
    });
    request.decision = "approved";
    request.decidedAt = new Date().toISOString();
    request.decidedBy = "user";

    const result = await executeTool(state, {
      toolId: "figma.write",
      sessionId: "sess-1",
      changeId: change.id
    });

    expect(result.ok).toBe(true);
  });
});
