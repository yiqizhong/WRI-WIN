import { describe, expect, it } from "vitest";

import { parseProject, parseProjectList } from "./project";

const timestamp = "2026-05-22T12:00:00.000Z";

describe("project contract", () => {
  it("accepts project metadata", () => {
    const project = parseProject({
      id: "proj-1",
      name: "Writer",
      rootPath: "/Users/example/Writer",
      createdAt: timestamp,
      updatedAt: timestamp
    });

    expect(project.name).toBe("Writer");
  });

  it("accepts a project list with active project", () => {
    const list = parseProjectList({
      projects: [
        {
          id: "proj-1",
          name: "Writer",
          rootPath: "/Users/example/Writer",
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      activeProjectId: "proj-1"
    });

    expect(list.activeProjectId).toBe("proj-1");
  });

  it("rejects invalid project payloads", () => {
    expect(() =>
      parseProject({
        id: "",
        name: "Writer",
        rootPath: "/tmp",
        createdAt: timestamp,
        updatedAt: timestamp
      })
    ).toThrow();
  });
});
