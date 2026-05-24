import { describe, expect, it } from "vitest";

import { parseFigmaReviewScope } from "./figma-scope";

describe("figma scope contract", () => {
  it("accepts frame scope", () => {
    const scope = parseFigmaReviewScope({
      kind: "frame",
      fileKey: "abc123",
      nodeId: "12:34",
      frameName: "Checkout"
    });

    expect(scope.kind).toBe("frame");
    expect(scope.frameName).toBe("Checkout");
  });

  it("rejects file-wide and flow scopes", () => {
    expect(() =>
      parseFigmaReviewScope({
        kind: "file",
        fileKey: "abc123"
      })
    ).toThrow();

    expect(() =>
      parseFigmaReviewScope({
        kind: "flow",
        fileKey: "abc123",
        nodeIds: ["12:34"]
      })
    ).toThrow();
  });
});
