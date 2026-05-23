import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PlatformStore } from "./store";

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
});
