import { describe, expect, it } from "vitest";

import {
  buildManualWorkflowFromUrls,
  detectWorkflowFromPage,
  frameNameFromParsedUrl,
  looksLikeFigmaFrameUrl,
  manualStepLabel
} from "./figma-audit-workflow-tabs";

describe("detectWorkflowFromPage", () => {
  it("returns frames from a page URL in page order", async () => {
    const result = await detectWorkflowFromPage({
      pageUrl: "https://www.figma.com/design/file123/Product?node-id=0-1",
      listPageFrames: async () => ({
        detectedDirection: "horizontal",
        frames: [
          {
            nodeId: "1:1",
            name: "Intro",
            parentPath: "Page / Intro",
            boundingBox: { x: 0, y: 0, width: 100, height: 100 }
          },
          {
            nodeId: "1:2",
            name: "Confirm",
            parentPath: "Page / Confirm",
            boundingBox: { x: 120, y: 0, width: 100, height: 100 }
          }
        ]
      })
    });

    expect(result).toEqual({
      fileKey: "file123",
      frames: [
        { nodeId: "1:1", name: "Intro", parentPath: "Page / Intro", checked: true },
        { nodeId: "1:2", name: "Confirm", parentPath: "Page / Confirm", checked: true }
      ]
    });
  });
});

describe("manual step frame labels", () => {
  it("detects frame URLs with node-id", () => {
    expect(
      looksLikeFigmaFrameUrl("https://www.figma.com/design/file123/Product?node-id=1-2")
    ).toBe(true);
    expect(looksLikeFigmaFrameUrl("https://www.figma.com/design/file123/Product")).toBe(false);
  });

  it("formats step labels with resolved frame names", () => {
    expect(manualStepLabel(0, { url: "https://example.com", detecting: true })).toBe("Step 1 - …");
    expect(manualStepLabel(1, { url: "https://example.com", frameName: "Checkout" })).toBe(
      "Step 2 - Checkout"
    );
    expect(frameNameFromParsedUrl({
      fileKey: "file123",
      nodeId: "1:2",
      suggestedScope: { kind: "frame", fileKey: "file123", nodeId: "1:2", frameName: "Login" }
    })).toBe("Login");
  });
});

describe("buildManualWorkflowFromUrls", () => {
  it("parses frame URLs and preserves pasted order", async () => {
    const result = await buildManualWorkflowFromUrls({
      urls: [
        "https://www.figma.com/design/file123/Product?node-id=1-2",
        "https://www.figma.com/design/file123/Product?node-id=1-1"
      ],
      parseFrameUrl: async (url) => ({
        fileKey: "file123",
        nodeId: url.includes("1-2") ? "1:2" : "1:1",
        suggestedScope: { kind: "frame", fileKey: "file123", nodeId: url.includes("1-2") ? "1:2" : "1:1" }
      })
    });

    expect(result).toEqual({
      fileKey: "file123",
      nodeIds: ["1:2", "1:1"],
      nodeNames: {}
    });
  });
});
