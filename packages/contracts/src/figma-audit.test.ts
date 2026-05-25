import { describe, expect, it } from "vitest";

import {
  createFigmaSessionInputSchema,
  listPageFramesResponseSchema,
  parseCreateFigmaSessionInput,
  sessionWritebackReportSchema
} from "./figma-audit";
import { reviewSessionSchema } from "./review-session";

describe("figma-audit contracts", () => {
  it("parses list-page-frames response", () => {
    const parsed = listPageFramesResponseSchema.parse({
      frames: [
        {
          nodeId: "1:10",
          name: "Checkout",
          parentPath: "Page / Checkout",
          boundingBox: { x: 0, y: 0, width: 320, height: 640 }
        }
      ],
      detectedDirection: "vertical"
    });
    expect(parsed.detectedDirection).toBe("vertical");
  });

  it("parses create figma session single frame", () => {
    const parsed = parseCreateFigmaSessionInput({
      mode: "single_frame",
      projectId: "proj-1",
      featureName: "Checkout",
      description: "Payment flow copy",
      url: "https://www.figma.com/design/abc/Demo?node-id=1-10"
    });
    expect(parsed.mode).toBe("single_frame");
    expect(parsed.productId).toBeUndefined();
  });

  it("parses create figma session workflow", () => {
    const parsed = parseCreateFigmaSessionInput({
      mode: "workflow",
      projectId: "proj-1",
      productId: "checkout",
      featureName: "Onboarding",
      description: "Three-step signup",
      fileKey: "abc123",
      nodeIds: ["1:10", "1:20"]
    });
    expect(parsed.mode).toBe("workflow");
    if (parsed.mode === "workflow") {
      expect(parsed.nodeIds).toHaveLength(2);
    }
  });

  it("rejects workflow without nodeIds", () => {
    expect(() =>
      createFigmaSessionInputSchema.parse({
        mode: "workflow",
        projectId: "proj-1",
        featureName: "Onboarding",
        description: "Steps",
        fileKey: "abc123",
        nodeIds: []
      })
    ).toThrow();
  });

  it("round-trips review session with audit metadata", () => {
    const parsed = reviewSessionSchema.parse({
      id: "sess-1",
      projectId: "proj-1",
      sourceType: "figma",
      scope: { fileKey: "abc" },
      status: "reviewing",
      agentRunIds: [],
      featureName: "Checkout",
      description: "Payment flow",
      mode: "single_frame",
      frameScreenshots: [{ frameId: "1:10", fileRef: "/tmp/1-10.png" }],
      writebackReport: {
        attemptedAt: "2026-05-25T12:00:00.000Z",
        written: 2,
        skipped: 1,
        failed: [{ nodeId: "1:11", errorCode: "write_failed", errorMessage: "Permission denied" }]
      },
      createdAt: "2026-05-25T12:00:00.000Z",
      updatedAt: "2026-05-25T12:00:00.000Z"
    });
    expect(parsed.writebackReport?.failed).toHaveLength(1);
  });

  it("accepts session writeback report with empty failed list", () => {
    const parsed = sessionWritebackReportSchema.parse({
      attemptedAt: "2026-05-25T12:00:00.000Z",
      written: 0,
      skipped: 3,
      failed: []
    });
    expect(parsed.skipped).toBe(3);
  });
});
