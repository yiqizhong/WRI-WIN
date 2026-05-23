import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PlatformStore, STORAGE_VERSION } from "./store";

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
      scope: { fileKey: "abc" },
      status: "draft",
      agentRunIds: [],
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await store.save();

    const reloaded = new PlatformStore({ dataDir });
    await reloaded.load();

    const sessions = reloaded.listSessions("proj-1");
    expect(sessions.sessions[0]?.id).toBe("sess-1");
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
