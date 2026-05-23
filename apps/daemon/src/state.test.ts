import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { describe, expect, it } from "vitest";

import { createProject, listProjects } from "./state";

describe("daemon state", () => {
  it("creates projects and persists via PlatformStore", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-daemon-state-"));
    const store = new PlatformStore({ dataDir });
    await store.load();

    const state = { store, permissionRequests: [] };

    await createProject(state, {
      name: "Writer",
      rootPath: "/tmp/writer"
    });

    const reloadedStore = new PlatformStore({ dataDir });
    await reloadedStore.load();

    const projects = listProjects({ store: reloadedStore, permissionRequests: [] });
    expect(projects.projects).toHaveLength(1);
    expect(projects.activeProjectId).toBe(projects.projects[0]?.id);
  });
});
