import { describe, expect, it } from "vitest";

import { resolveFigmaFrameDisplayName } from "./figma-frame-label";
import type { ReviewSession } from "./review-session";

function session(partial: Partial<ReviewSession> & Pick<ReviewSession, "scope">): ReviewSession {
  return {
    id: "s1",
    projectId: "p1",
    sourceType: "figma",
    status: "completed",
    agentRunIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial
  };
}

describe("resolveFigmaFrameDisplayName", () => {
  it("prefers design context hierarchy name", () => {
    const result = resolveFigmaFrameDisplayName(
      session({
        scope: {
          suggestedScope: { kind: "flow", fileKey: "abc", nodeIds: ["1:10", "1:20"] },
          designContext: {
            fileKey: "abc",
            hierarchy: [
              { id: "1:10", name: "Checkout", type: "FRAME" },
              { id: "1:20", name: "Confirm", type: "FRAME" }
            ],
            flowOrder: ["1:10", "1:20"],
            capturedAt: "2026-01-01T00:00:00.000Z"
          }
        }
      }),
      "1:20"
    );

    expect(result).toBe("Confirm");
  });

  it("uses single-frame frameName when hierarchy is missing", () => {
    const result = resolveFigmaFrameDisplayName(
      session({
        scope: {
          suggestedScope: {
            kind: "frame",
            fileKey: "abc",
            nodeId: "1:10",
            frameName: "Login"
          }
        }
      }),
      "1:10"
    );

    expect(result).toBe("Login");
  });

  it("uses flow nodeNames map when hierarchy is missing", () => {
    const result = resolveFigmaFrameDisplayName(
      session({
        scope: {
          suggestedScope: {
            kind: "flow",
            fileKey: "abc",
            nodeIds: ["1:10", "1:20"],
            nodeNames: { "1:10": "Step A", "1:20": "Step B" }
          }
        }
      }),
      "1:10"
    );

    expect(result).toBe("Step A");
  });

  it("decodes HTML entities in Figma names", () => {
    const result = resolveFigmaFrameDisplayName(
      session({
        scope: {
          suggestedScope: {
            kind: "frame",
            fileKey: "abc",
            nodeId: "1:10",
            frameName: "Save &amp; continue"
          }
        }
      }),
      "1:10"
    );

    expect(result).toBe("Save & continue");
  });
});
