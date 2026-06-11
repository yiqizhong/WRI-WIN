import { describe, expect, it } from "vitest";

import type { ReviewSession } from "@writer/contracts";

import {
  buildFigmaDesignFrameUrl,
  resolveAuditSessionFigmaLinks
} from "./audit-session-figma-links";

function session(scope: Record<string, unknown>): ReviewSession {
  return {
    id: "sess-1",
    projectId: "proj-1",
    sourceType: "figma",
    scope,
    status: "completed",
    agentRunIds: [],
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z"
  };
}

describe("buildFigmaDesignFrameUrl", () => {
  it("encodes node ids with hyphens", () => {
    expect(buildFigmaDesignFrameUrl("abc123", "1:10")).toBe(
      "https://www.figma.com/design/abc123?node-id=1-10"
    );
  });
});

describe("resolveAuditSessionFigmaLinks", () => {
  it("returns the submitted frame URL for single-frame sessions", () => {
    const url = "https://www.figma.com/design/abc/Demo?node-id=1-10";

    expect(
      resolveAuditSessionFigmaLinks(
        session({
          url,
          fileKey: "abc",
          nodeId: "1:10",
          suggestedScope: { kind: "frame", fileKey: "abc", nodeId: "1:10" }
        })
      )
    ).toEqual([url]);
  });

  it("builds frame URLs for page-by-page workflow sessions", () => {
    expect(
      resolveAuditSessionFigmaLinks(
        session({
          fileKey: "abc",
          suggestedScope: {
            kind: "flow",
            fileKey: "abc",
            nodeIds: ["1:10", "1:20"]
          }
        })
      )
    ).toEqual([
      "https://www.figma.com/design/abc?node-id=1-10",
      "https://www.figma.com/design/abc?node-id=1-20"
    ]);
  });

  it("shows one stored page URL for All in one workflow sessions", () => {
    const pageUrl = "https://www.figma.com/design/abc/AI-test?node-id=1182-3984";

    expect(
      resolveAuditSessionFigmaLinks(
        session({
          url: pageUrl,
          fileKey: "abc",
          suggestedScope: {
            kind: "flow",
            fileKey: "abc",
            nodeIds: ["1182:3984", "1182:4000"]
          }
        })
      )
    ).toEqual([pageUrl]);
  });
});
