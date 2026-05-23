import { describe, expect, it } from "vitest";

import { mcpSmokeResultSchema, parseMcpServerList } from "./mcp-server";

describe("mcp server contract", () => {
  it("accepts MCP server status payloads", () => {
    const list = parseMcpServerList({
      servers: [
        {
          id: "figma",
          name: "Figma MCP",
          enabled: true,
          status: "connected",
          capabilities: ["figma.read", "figma.write"],
          tools: [{ name: "get_file", description: "Read Figma file metadata" }],
          diagnostic: {
            code: "ready",
            severity: "info",
            message: "Figma MCP connected."
          }
        }
      ]
    });

    expect(list.servers[0]?.status).toBe("connected");
    expect(list.servers[0]?.tools?.[0]?.name).toBe("get_file");
    expect(list.servers[0]?.diagnostic?.code).toBe("ready");
  });

  it("parses Figma MCP read smoke results", () => {
    const result = mcpSmokeResultSchema.parse({
      ok: false,
      serverId: "figma",
      diagnostic: {
        code: "not_configured",
        severity: "warning",
        message: "Figma MCP command is not configured.",
        recoveryAction: "Set WRITER_FIGMA_MCP_COMMAND."
      }
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostic?.code).toBe("not_configured");
  });

  it("rejects invalid connection status", () => {
    expect(() =>
      parseMcpServerList({
        servers: [
          {
            id: "figma",
            name: "Figma MCP",
            enabled: false,
            status: "offline",
            capabilities: []
          }
        ]
      })
    ).toThrow();
  });
});
