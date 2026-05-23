import { describe, expect, it } from "vitest";

import { FigmaUrlParseError, parseFigmaUrl } from "./figma-url";

describe("parseFigmaUrl", () => {
  it("parses design URLs with node id", () => {
    const parsed = parseFigmaUrl("https://www.figma.com/design/abc123/File?node-id=12-34");

    expect(parsed.fileKey).toBe("abc123");
    expect(parsed.nodeId).toBe("12:34");
    expect(parsed.suggestedScope.kind).toBe("frame");
  });

  it("parses file-wide scope without node id", () => {
    const parsed = parseFigmaUrl("https://www.figma.com/design/xyz999/My-File");

    expect(parsed.suggestedScope.kind).toBe("file");
  });

  it("rejects non-figma hosts", () => {
    expect(() => parseFigmaUrl("https://example.com/design/abc")).toThrow(FigmaUrlParseError);
  });
});
