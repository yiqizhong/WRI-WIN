import { describe, expect, it } from "vitest";

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";

import { createDefaultMcpState, smokeFigmaRead } from "./mcp";
import { getFigmaMcpConfigFromEnv } from "./mcp";
import type { DaemonState } from "./state";

async function createTestState(): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-mcp-smoke-"));
  const store = new PlatformStore({ dataDir });
  await store.load();

  return {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: createDefaultMcpState()
  };
}

describe("figma mcp smoke", () => {
  it("reports not configured without a command", async () => {
    const state = await createTestState();
    const result = await smokeFigmaRead(state);
    expect(result.ok).toBe(false);
    expect(result.diagnostic?.code).toBe("not_configured");
  });

  it("loads remote Figma MCP URL config", () => {
    const config = getFigmaMcpConfigFromEnv({
      WRITER_FIGMA_MCP_URL: "https://mcp.figma.com/mcp",
      WRITER_FIGMA_MCP_AUTH_TOKEN: "oauth-token"
    });

    expect(config.transport).toBe("http");
    expect(config.url).toBe("https://mcp.figma.com/mcp");
    expect(config.headers?.Authorization).toBe("Bearer oauth-token");
  });

  it("reports tool_not_found when connected without a read tool", async () => {
    const state = await createTestState();
    state.mcp.figma.enabled = true;
    state.mcp.figma.status = "connected";
    state.mcp.figma.tools = [{ name: "write_comment" }];

    const result = await smokeFigmaRead(state);

    expect(result.ok).toBe(false);
    expect(result.diagnostic?.code).toBe("tool_not_found");
    expect(result.metadata?.tools).toEqual(["write_comment"]);
  });

  it("runs a read smoke through the connected MCP client", async () => {
    const state = await createTestState();
    state.mcp.figma.enabled = true;
    state.mcp.figma.status = "connected";
    state.mcp.figma.tools = [{ name: "figma_get_file" }];
    state.mcp.figmaClient = {
      connect: async () => ({ ok: true }),
      listTools: async () => [{ name: "figma_get_file" }],
      callTool: async (name: string) => ({
        ok: true,
        result: { content: [{ type: "text", text: `called ${name}` }] }
      }),
      close: async () => undefined
    };

    const result = await smokeFigmaRead(state);

    expect(result.ok).toBe(true);
    expect(result.toolName).toBe("figma_get_file");
    expect(result.result).toEqual({ content: [{ type: "text", text: "called figma_get_file" }] });
  });
});
