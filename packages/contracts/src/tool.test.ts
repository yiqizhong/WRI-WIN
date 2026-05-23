import { describe, expect, it } from "vitest";

import { parseToolList } from "./tool";

describe("tool contract", () => {
  it("accepts tool registry entries with risk metadata", () => {
    const list = parseToolList({
      tools: [
        {
          id: "figma.read",
          name: "Read Figma metadata",
          source: "figma-mcp",
          capability: "figma.read",
          risk: "read_only"
        },
        {
          id: "figma.write",
          name: "Write Figma text",
          source: "figma-mcp",
          capability: "figma.write",
          risk: "write"
        }
      ]
    });

    expect(list.tools[1]?.risk).toBe("write");
  });

  it("rejects unknown risk levels", () => {
    expect(() =>
      parseToolList({
        tools: [
          {
            id: "bad",
            name: "Bad tool",
            source: "test",
            capability: "test",
            risk: "admin"
          }
        ]
      })
    ).toThrow();
  });
});
