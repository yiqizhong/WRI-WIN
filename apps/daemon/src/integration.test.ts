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
      version: "test",
      apiRevision: "4",
      packaged: false
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

  it("allows local dev renderer origins beyond the default Vite port", async () => {
    const origin = "http://127.0.0.1:5174";
    const health = await fetch(`${baseUrl}/health`, {
      headers: { Origin: origin }
    });

    expect(health.headers.get("access-control-allow-origin")).toBe(origin);
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

    const parsed = (await parseRes.json()) as { suggestedScope: { kind: string }; frameName?: string };
    expect(parsed.frameName).toBeUndefined();
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

  it("enriches parse-url with frame name when Figma MCP is connected", async () => {
    testState.mcp.figma.enabled = true;
    testState.mcp.figma.status = "connected";
    testState.mcp.figmaClient = {
      connect: async () => ({ ok: true }),
      listTools: async () => [{ name: "get_metadata" }],
      callTool: async (name: string, _args: Record<string, unknown>) => {
        if (name === "get_metadata") {
          return {
            ok: true,
            result: {
              content: [{ type: "text", text: `<frame id="1:2" name="Checkout" type="FRAME" />` }]
            }
          };
        }

        return {
          ok: false,
          diagnostic: {
            code: "tool_not_found",
            severity: "error",
            message: "unsupported",
            recoveryAction: "Use a supported Figma MCP tool."
          }
        };
      },
      finishAuth: async () => ({ ok: true }),
      close: async () => undefined
    };

    const parseRes = await fetch(`${baseUrl}/figma/parse-url`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://www.figma.com/design/abc123/Demo?node-id=1-2" })
    });
    expect(parseRes.ok).toBe(true);

    const parsed = (await parseRes.json()) as {
      frameName?: string;
      suggestedScope: { kind: string; frameName?: string };
    };
    expect(parsed.frameName).toBe("Checkout");
    expect(parsed.suggestedScope).toMatchObject({ kind: "frame", frameName: "Checkout" });
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
        mode: "single_frame",
        projectId: project.id,
        featureName: "Checkout",
        description: "Integration smoke frame",
        url: "https://www.figma.com/design/abc123/Demo?node-id=1-10"
      })
    });
    const session = (await sessionRes.json()) as { id: string };

    // beforeAll's refreshAgentDetection may have selected a real, locally
    // installed agent CLI as the active adapter. The Figma audit now launches
    // an LLM run, so leaving a live adapter active would invoke that CLI and
    // hang this test. Clear it so the audit exercises its deterministic
    // stub/seed fallback path (which is what this smoke test asserts on).
    testState.store.setActiveAdapterId(null);

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
