import { createServer, type Server } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DaemonConfig } from "./config";
import { createRequestHandler } from "./router";
import type { DaemonState } from "./state";
import { refreshAgentDetection } from "./agents";
import { createDefaultMcpState } from "./mcp";

async function createTestState(): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-integration-"));
  const store = new PlatformStore({ dataDir });
  await store.load();

  return {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: createDefaultMcpState()
  };
}

const FRAME_METADATA = `
<frame id="1:10" name="Login" type="FRAME">
  <text id="1:11" name="Primary CTA" type="TEXT" visible="true" />
</frame>
`;

describe("daemon integration smoke", () => {
  let baseUrl = "";
  let server: Server;
  let testState: DaemonState;

  beforeAll(async () => {
    const config: DaemonConfig = {
      host: "127.0.0.1",
      port: 0,
      logDir: await mkdtemp(join(tmpdir(), "writer-integration-logs-")),
      logLevel: "error",
      version: "test"
    };
    testState = await createTestState();
    await refreshAgentDetection(testState);
    const handler = createRequestHandler(config, testState);

    server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to bind integration test server");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves health and agent discovery", async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.ok).toBe(true);

    const agents = await fetch(`${baseUrl}/agents`);
    expect(agents.ok).toBe(true);
    const agentPayload = (await agents.json()) as { adapters: Array<{ id: string }> };
    expect(agentPayload.adapters.length).toBeGreaterThan(0);
    expect(agentPayload.adapters.some((adapter) => adapter.id === "echo")).toBe(false);
  });

  it("exposes implicit workspace without folder pick", async () => {
    const workspaceRes = await fetch(`${baseUrl}/workspace`);
    expect(workspaceRes.ok).toBe(true);
    const workspace = (await workspaceRes.json()) as { projectId: string; products: unknown[] };
    expect(workspace.projectId).toBeTruthy();
    expect(Array.isArray(workspace.products)).toBe(true);
  });

  it("runs echo agent end to end", async () => {
    const projectRes = await fetch(`${baseUrl}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Integration", rootPath: "/tmp/writer-integration" })
    });
    expect(projectRes.ok).toBe(true);
    const project = (await projectRes.json()) as { id: string };

    const sessionRes = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        sourceType: "figma",
        scope: { kind: "file", fileKey: "abc123" }
      })
    });
    expect(sessionRes.ok).toBe(true);
    const session = (await sessionRes.json()) as { id: string };

    const runRes = await fetch(`${baseUrl}/agents/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        adapterId: "echo",
        prompt: "integration-smoke"
      })
    });
    expect(runRes.ok).toBe(true);
    const runPayload = (await runRes.json()) as { run: { status: string } };
    expect(runPayload.run.status).toBe("completed");
  });

  it("parses figma urls and extracts text nodes", async () => {
    const parseRes = await fetch(`${baseUrl}/figma/parse-url`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://www.figma.com/design/abc123/Demo?node-id=1-2" })
    });
    expect(parseRes.ok).toBe(true);

    const parsed = (await parseRes.json()) as { suggestedScope: { kind: string } };
    const extractRes = await fetch(`${baseUrl}/figma/extract`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope: parsed.suggestedScope })
    });
    expect(extractRes.ok).toBe(true);
    const extraction = (await extractRes.json()) as {
      extraction: { nodes: unknown[] };
      diagnostic?: { code: string };
    };
    expect(extraction.diagnostic?.code).toBe("mcp_not_ready");
    expect(extraction.extraction.nodes).toHaveLength(0);
  });

  it("runs figma audit with injected MCP client and real extracted text", async () => {
    testState.mcp.figma.enabled = true;
    testState.mcp.figma.status = "connected";
    testState.mcp.figmaClient = {
      connect: async () => ({ ok: true }),
      listTools: async () => [{ name: "get_metadata" }, { name: "get_design_context" }, { name: "use_figma" }],
      callTool: async (name: string, args: Record<string, unknown>) => {
        if (name === "get_metadata") {
          return {
            ok: true,
            result: { content: [{ type: "text", text: FRAME_METADATA }] }
          };
        }

        if (name === "use_figma" && String(args.code).includes("return { nodeId")) {
          return {
            ok: true,
            result: {
              content: [{ type: "text", text: JSON.stringify({ nodeId: "1:11", characters: "Click here" }) }]
            }
          };
        }

        if (name === "get_design_context") {
          return {
            ok: true,
            result: {
              content: [{ type: "text", text: "<a>Click here</a>" }]
            }
          };
        }

        return { ok: false };
      },
      finishAuth: async () => ({ ok: true }),
      close: async () => undefined
    };

    const projectRes = await fetch(`${baseUrl}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Figma MCP", rootPath: "/tmp/writer-figma-mcp" })
    });
    const project = (await projectRes.json()) as { id: string };

    const sessionRes = await fetch(`${baseUrl}/sessions/figma`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        productId: "checkout",
        url: "https://www.figma.com/design/abc123/Demo?node-id=1-10"
      })
    });
    const session = (await sessionRes.json()) as { id: string };

    const auditRes = await fetch(`${baseUrl}/review/audit/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id })
    });
    expect(auditRes.ok).toBe(true);

    const audit = (await auditRes.json()) as {
      changes: Array<{ before: string }>;
      diagnostic?: { code: string };
    };
    expect(audit.diagnostic).toBeUndefined();
    expect(audit.changes.some((change) => change.before === "Click here")).toBe(true);
  });
});
