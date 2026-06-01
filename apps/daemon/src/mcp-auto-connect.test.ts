import { describe, expect, it } from "vitest";

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";

import { createFigmaOAuthProvider } from "./figma-mcp-oauth";
import { autoConnectFigmaMcp, createDefaultMcpState } from "./mcp";
import type { createMcpClient } from "./mcp-client";
import type { DaemonState } from "./state";

const REMOTE_ENV = { WRITER_FIGMA_MCP_URL: "https://mcp.figma.com/mcp" };

async function createTestState(createClient?: typeof createMcpClient): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-mcp-auto-"));
  const store = new PlatformStore({ dataDir });
  await store.load();

  return {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: createDefaultMcpState({ createClient, env: REMOTE_ENV })
  };
}

async function providerWithTokens(): Promise<ReturnType<typeof createFigmaOAuthProvider>> {
  const dir = await mkdtemp(join(tmpdir(), "writer-auth-"));
  const storePath = join(dir, "figma.json");
  await writeFile(storePath, JSON.stringify({ tokens: { access_token: "tok" } }), "utf8");
  return createFigmaOAuthProvider({ storePath });
}

async function providerWithoutTokens(): Promise<ReturnType<typeof createFigmaOAuthProvider>> {
  const dir = await mkdtemp(join(tmpdir(), "writer-auth-"));
  return createFigmaOAuthProvider({ storePath: join(dir, "figma.json") });
}

describe("autoConnectFigmaMcp", () => {
  it("stays disabled when no stored tokens exist", async () => {
    const state = await createTestState();
    const figma = await autoConnectFigmaMcp(state, await providerWithoutTokens());

    expect(figma.enabled).toBe(false);
    expect(figma.status).toBe("disconnected");
    expect(state.mcp.figmaClient ?? null).toBeNull();
  });

  it("connects silently when stored tokens exist", async () => {
    const fakeClient = {
      connect: async () => ({ ok: true }),
      listTools: async () => [{ name: "get_metadata" }],
      callTool: async () => ({ ok: true, result: {} }),
      finishAuth: async () => ({ ok: true }),
      close: async () => undefined
    };
    const state = await createTestState((() => fakeClient) as unknown as typeof createMcpClient);

    const figma = await autoConnectFigmaMcp(state, await providerWithTokens());

    expect(figma.enabled).toBe(true);
    expect(figma.status).toBe("connected");
    // Tools are the canonical Figma set merged with whatever the server lists,
    // so the full callable surface (incl. write/design tools the server omits
    // from tools/list) is exposed, not just the listed `get_metadata`.
    expect(figma.tools).toEqual(
      expect.arrayContaining([
        { name: "get_metadata" },
        { name: "use_figma" },
        { name: "generate_figma_design" }
      ])
    );
    expect(state.mcp.figmaClient).toBe(fakeClient);
  });

  it("stays disabled when stored tokens are present but the connection fails", async () => {
    const fakeClient = {
      connect: async () => ({
        ok: false,
        diagnostic: { code: "needs_auth", severity: "warning", message: "expired" }
      }),
      listTools: async () => [],
      callTool: async () => ({ ok: false }),
      finishAuth: async () => ({ ok: true }),
      close: async () => undefined
    };
    const state = await createTestState((() => fakeClient) as unknown as typeof createMcpClient);

    const figma = await autoConnectFigmaMcp(state, await providerWithTokens());

    expect(figma.enabled).toBe(false);
    expect(state.mcp.figmaClient ?? null).toBeNull();
  });
});
