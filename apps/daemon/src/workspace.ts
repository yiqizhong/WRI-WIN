import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import type { WorkspaceInfo } from "@writer/contracts";

import { getCachedTree } from "./guidelines/cache";
import { discoverGuidelines } from "./guidelines/discovery";
import { loadSlotDisplayNames } from "./guidelines/slot-display-names";
import { toGuidelinesTreeApi } from "./guidelines/tree-api";
import type { DaemonState } from "./state";

/** Stable id for the implicit app workspace (not a user-picked folder). */
export const DEFAULT_WORKSPACE_PROJECT_ID = "writer-workspace";

export async function ensureDefaultWorkspace(state: DaemonState) {
  const projects = state.store.listProjects();
  const existing = projects.projects.find((item) => item.id === DEFAULT_WORKSPACE_PROJECT_ID);
  const rootPath = join(state.store.dataDir, "workspace");
  await mkdir(rootPath, { recursive: true });
  const timestamp = new Date().toISOString();

  if (existing) {
    if (existing.rootPath === rootPath) {
      return existing;
    }

    const updated = state.store.upsertProject({
      ...existing,
      rootPath,
      updatedAt: timestamp
    });
    await state.store.save();
    return updated;
  }

  const project = state.store.upsertProject({
    id: DEFAULT_WORKSPACE_PROJECT_ID,
    name: "Writer",
    rootPath,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await state.store.save();
  return project;
}

export async function getWorkspaceInfo(state: DaemonState): Promise<WorkspaceInfo> {
  const project = await ensureDefaultWorkspace(state);
  const tree = getCachedTree() ?? (await discoverGuidelines());
  const display = await loadSlotDisplayNames();
  const apiTree = toGuidelinesTreeApi(tree, display);

  return {
    projectId: project.id,
    lastProductId: project.activeProductId ?? null,
    products: apiTree.products
  };
}
