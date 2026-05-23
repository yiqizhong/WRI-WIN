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
  it("defaults to the official remote Figma MCP URL", () => {
    const config = getFigmaMcpConfigFromEnv({});
    expect(config.transport).toBe("http");
    expect(config.url).toBe("https://mcp.figma.com/mcp");
  });

  it("reports startup_failed when not connected", async () => {
    const state = await createTestState();
    state.mcp.env = { WRITER_FIGMA_MCP_URL: "https://mcp.figma.com/mcp" };
    const result = await smokeFigmaRead(state);
    expect(result.ok).toBe(false);
    expect(result.diagnostic?.code).toBe("startup_failed");
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
    state.mcp.figmaClient = {
      connect: async () => ({ ok: true }),
      listTools: async () => [{ name: "write_comment" }],
      callTool: async () => ({ ok: true, result: {} }),
      finishAuth: async () => ({ ok: true }),
      close: async () => undefined
    };

    const result = await smokeFigmaRead(state);

    expect(result.ok).toBe(false);
    expect(result.diagnostic?.code).toBe("tool_not_found");
    expect(result.metadata?.tools).toEqual(["write_comment"]);
  });

  it("prefers whoami for read smoke tool selection", async () => {
    const state = await createTestState();
    state.mcp.figma.enabled = true;
    state.mcp.figma.status = "connected";
    state.mcp.figma.tools = [{ name: "create_new_file" }, { name: "whoami" }, { name: "get_metadata" }];
    state.mcp.figmaClient = {
      connect: async () => ({ ok: true }),
      listTools: async () => state.mcp.figma.tools ?? [],
      callTool: async (name: string) => ({
        ok: true,
        result: { content: [{ type: "text", text: `called ${name}` }] }
      }),
      finishAuth: async () => ({ ok: true }),
      close: async () => undefined
    };

    const result = await smokeFigmaRead(state);

    expect(result.ok).toBe(true);
    expect(result.toolName).toBe("whoami");
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
      finishAuth: async () => ({ ok: true }),
      close: async () => undefined
    };

    const result = await smokeFigmaRead(state);

    expect(result.ok).toBe(true);
    expect(result.toolName).toBe("figma_get_file");
    expect(result.result).toEqual({ content: [{ type: "text", text: "called figma_get_file" }] });
  });
});
