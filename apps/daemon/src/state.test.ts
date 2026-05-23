import { describe, expect, it } from "vitest";

import { createDaemonState, createProject, createSession, listProjects } from "./state";

describe("daemon state", () => {
  it("creates projects and sessions in memory", () => {
    const state = createDaemonState();

    const project = createProject(state, {
      name: "Writer",
      rootPath: "/tmp/writer"
    });

    const session = createSession(state, {
      projectId: project.id,
      sourceType: "figma",
      scope: { fileKey: "abc" }
    });

    const projects = listProjects(state);
    expect(projects.activeProjectId).toBe(project.id);
    expect(session.projectId).toBe(project.id);
  });
});
