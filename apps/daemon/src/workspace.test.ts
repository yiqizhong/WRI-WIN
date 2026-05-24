import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { describe, expect, it } from "vitest";

import type { DaemonState } from "./state";
import { DEFAULT_WORKSPACE_PROJECT_ID, ensureDefaultWorkspace, getWorkspaceInfo } from "./workspace";

async function createTestState(): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-workspace-"));
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

describe("implicit workspace", () => {
  it("creates a stable default project without user folder pick", async () => {
    const state = await createTestState();
    const project = await ensureDefaultWorkspace(state);

    expect(project.id).toBe(DEFAULT_WORKSPACE_PROJECT_ID);
    expect(project.rootPath).toContain("workspace");

    const again = await ensureDefaultWorkspace(state);
    expect(again.id).toBe(project.id);
    expect(state.store.listProjects().projects).toHaveLength(1);
  });

  it("returns workspace info with product list", async () => {
    const state = await createTestState();
    const info = await getWorkspaceInfo(state);

    expect(info.projectId).toBe(DEFAULT_WORKSPACE_PROJECT_ID);
    expect(Array.isArray(info.products)).toBe(true);
  });
});
