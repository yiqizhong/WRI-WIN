import { describe, expect, it } from "vitest";

import { parseFigmaReviewScope } from "./figma-scope";

describe("figma scope contract", () => {
  it("accepts frame scope", () => {
    const scope = parseFigmaReviewScope({
      kind: "frame",
      fileKey: "abc123",
      nodeId: "12:34"
    });

    expect(scope.kind).toBe("frame");
  });
});
