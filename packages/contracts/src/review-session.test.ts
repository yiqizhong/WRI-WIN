import { describe, expect, it } from "vitest";

import { parseReviewSession, parseReviewSessionList } from "./review-session";

const timestamp = "2026-05-22T12:00:00.000Z";

describe("review session contract", () => {
  it("accepts review session metadata", () => {
    const session = parseReviewSession({
      id: "sess-1",
      projectId: "proj-1",
      sourceType: "figma",
      scope: { fileKey: "abc123" },
      status: "running",
      agentRunIds: ["run-1"],
      createdAt: timestamp,
      updatedAt: timestamp
    });

    expect(session.sourceType).toBe("figma");
    expect(session.agentRunIds).toHaveLength(1);
  });

  it("accepts a session list", () => {
    const list = parseReviewSessionList({
      sessions: [
        {
          id: "sess-1",
          projectId: "proj-1",
          sourceType: "pasted_text",
          scope: {},
          status: "draft",
          agentRunIds: [],
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ]
    });

    expect(list.sessions).toHaveLength(1);
  });

  it("rejects unknown source types", () => {
    expect(() =>
      parseReviewSession({
        id: "sess-1",
        projectId: "proj-1",
        sourceType: "email",
        scope: {},
        status: "draft",
        agentRunIds: [],
        createdAt: timestamp,
        updatedAt: timestamp
      })
    ).toThrow();
  });
});
