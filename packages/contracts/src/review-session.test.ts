import { describe, expect, it } from "vitest";

import { parseReviewQueue } from "./review-queue";
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

  it("accepts persisted frame extraction, design context, and diagnostics", () => {
    const session = parseReviewSession({
      id: "sess-figma",
      projectId: "proj-1",
      sourceType: "figma",
      scope: { kind: "frame", fileKey: "abc123", nodeId: "12:34" },
      status: "draft",
      agentRunIds: [],
      figmaExtraction: {
        scope: { kind: "frame", fileKey: "abc123", nodeId: "12:34" },
        nodes: [
          {
            id: "56:78",
            name: "Primary CTA",
            path: ["Checkout", "Primary CTA"],
            characters: "Pay now",
            visible: true
          }
        ],
        warnings: [
          {
            code: "partial_read_failure",
            severity: "warning",
            message: "One text node could not be read."
          }
        ],
        extractedAt: timestamp
      },
      designContext: {
        fileKey: "abc123",
        focusNodeId: "12:34",
        hierarchy: [{ id: "12:34", name: "Checkout", type: "FRAME" }],
        capturedAt: timestamp
      },
      diagnostic: {
        code: "mcp_not_ready",
        severity: "error",
        message: "Connect Figma MCP to read this Frame."
      },
      createdAt: timestamp,
      updatedAt: timestamp
    });

    expect(session.figmaExtraction?.nodes[0]?.id).toBe("56:78");
    expect(session.designContext?.focusNodeId).toBe("12:34");
    expect(session.diagnostic?.code).toBe("mcp_not_ready");
  });

  it("parses the typed review queue result for a frame audit", () => {
    const queue = parseReviewQueue({
      findings: [],
      rewrites: [],
      changes: [],
      diagnostic: {
        code: "mcp_not_ready",
        severity: "error",
        message: "Connect Figma MCP to read this Frame."
      }
    });

    expect(queue.diagnostic?.code).toBe("mcp_not_ready");
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
