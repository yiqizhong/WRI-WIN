import { describe, expect, it } from "vitest";

import { FigmaUrlParseError, parseFigmaUrl } from "./figma-url";

describe("parseFigmaUrl", () => {
  it("parses design URLs with node id", () => {
    const parsed = parseFigmaUrl("https://www.figma.com/design/abc123/File?node-id=12-34");

    expect(parsed.fileKey).toBe("abc123");
    expect(parsed.nodeId).toBe("12:34");
    expect(parsed.suggestedScope.kind).toBe("frame");
  });

  it("rejects design URLs without a selected frame node id", () => {
    expect(() => parseFigmaUrl("https://www.figma.com/design/xyz999/My-File")).toThrow(
      "Select a Figma Frame and paste its link"
    );
  });

  it("rejects non-design Figma sources with selected Frame guidance", () => {
    expect(() => parseFigmaUrl("https://www.figma.com/make/xyz999/Demo?node-id=12-34")).toThrow(
      "Figma Make files are not supported"
    );

    for (const source of ["board", "slides"]) {
      expect(() => parseFigmaUrl(`https://www.figma.com/${source}/xyz999/Demo?node-id=12-34`)).toThrow(
        "selected Figma design Frame"
      );
    }
  });

  it("rejects non-figma hosts", () => {
    expect(() => parseFigmaUrl("https://example.com/design/abc")).toThrow(FigmaUrlParseError);
  });
});
