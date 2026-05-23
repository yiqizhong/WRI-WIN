import type { Tool, ToolRiskLevel } from "@writer/contracts";

export type ToolRegistry = {
  list: () => Tool[];
  get: (id: string) => Tool | undefined;
  requiresPermission: (risk: ToolRiskLevel) => boolean;
};

export function createDefaultToolRegistry(): ToolRegistry {
  const tools: Tool[] = [
    {
      id: "filesystem.list",
      name: "List directory",
      source: "daemon",
      capability: "filesystem.read",
      risk: "read_only"
    },
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
  ];

  return {
    list: () => tools,
    get: (id) => tools.find((tool) => tool.id === id),
    requiresPermission: (risk) => risk === "write" || risk === "destructive"
  };
}
