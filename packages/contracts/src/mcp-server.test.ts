import { describe, expect, it } from "vitest";

import { parseMcpServerList } from "./mcp-server";

describe("mcp server contract", () => {
  it("accepts MCP server status payloads", () => {
    const list = parseMcpServerList({
      servers: [
        {
          id: "figma",
          name: "Figma MCP",
          enabled: true,
          status: "connected",
          capabilities: ["figma.read", "figma.write"]
        }
      ]
    });

    expect(list.servers[0]?.status).toBe("connected");
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
