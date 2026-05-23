import { describe, expect, it } from "vitest";

import { createMcpClient, type McpProtocolClient } from "./mcp-client";

function fakeProtocolClient(): McpProtocolClient {
  return {
    connect: async () => undefined,
    listTools: async () => ({
      tools: [
        {
          name: "figma_get_file",
          description: "Read Figma file metadata"
        }
      ]
    }),
    callTool: async ({ name }) => ({
      content: [{ type: "text", text: `called ${name}` }]
    }),
    close: async () => undefined
  };
}

describe("mcp client wrapper", () => {
  it("connects, lists tools, calls a tool, and closes", async () => {
    const client = createMcpClient(
      {
        command: "fake-figma-mcp",
        args: ["--stdio"],
        env: { FIGMA_ACCESS_TOKEN: "secret" }
      },
      fakeProtocolClient
    );

    const connected = await client.connect();
    expect(connected.ok).toBe(true);

    const tools = await client.listTools();
    expect(tools).toEqual([{ name: "figma_get_file", description: "Read Figma file metadata" }]);

    const result = await client.callTool("figma_get_file", { fileKey: "abc" });
    expect(result.ok).toBe(true);
    expect(result.result).toEqual({ content: [{ type: "text", text: "called figma_get_file" }] });

    await client.close();
  });

  it("returns not_configured when command is missing", async () => {
    const client = createMcpClient({}, fakeProtocolClient);

    const connected = await client.connect();

    expect(connected.ok).toBe(false);
    expect(connected.diagnostic?.code).toBe("not_configured");
    expect(connected.diagnostic?.recoveryAction).toContain("WRITER_FIGMA_MCP_COMMAND");
  });

  it("returns startup_failed when protocol connection throws", async () => {
    const client = createMcpClient(
      { command: "fake-figma-mcp" },
      () => ({
        ...fakeProtocolClient(),
        connect: async () => {
          throw new Error("server exploded");
        }
      })
    );

    const connected = await client.connect();

    expect(connected.ok).toBe(false);
    expect(connected.diagnostic?.code).toBe("startup_failed");
    expect(connected.diagnostic?.stderrSnippet).toContain("server exploded");
  });
});
