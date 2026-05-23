import { describe, expect, it } from "vitest";

import { createDefaultToolRegistry } from "./registry";

describe("tool registry", () => {
  it("lists tools with risk metadata", () => {
    const registry = createDefaultToolRegistry();
    const tools = registry.list();

    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((tool) => tool.id === "figma.write" && tool.risk === "write")).toBe(true);
  });

  it("requires permission for write tools", () => {
    const registry = createDefaultToolRegistry();

    expect(registry.requiresPermission("read_only")).toBe(false);
    expect(registry.requiresPermission("write")).toBe(true);
  });
});
