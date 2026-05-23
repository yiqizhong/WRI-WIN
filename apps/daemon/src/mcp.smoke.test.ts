import { describe, expect, it } from "vitest";

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";

import { createDefaultMcpState, smokeFigmaRead } from "./mcp";
import type { DaemonState } from "./state";

async function createTestState(): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-mcp-smoke-"));
  const store = new PlatformStore({ dataDir });
  await store.load();

  return {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: createDefaultMcpState()
  };
}

describe("figma mcp smoke (manual credentials)", () => {
  it("read smoke works without token", async () => {
    const state = await createTestState();
    const result = smokeFigmaRead(state);
    expect(result.metadata.smoke).toBe("read_metadata");
  });

  it.runIf(Boolean(process.env.FIGMA_ACCESS_TOKEN))("read smoke with token", async () => {
    const state = await createTestState();
    state.mcp.figma.enabled = true;
    const result = smokeFigmaRead(state);
    expect(result.configured).toBe(true);
  });
});
