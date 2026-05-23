import { createServer, type Server } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DaemonConfig } from "./config";
import { createRequestHandler } from "./router";
import type { DaemonState } from "./state";
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

describe("daemon integration smoke", () => {
  let baseUrl = "";
  let server: Server;

  beforeAll(async () => {
    const config: DaemonConfig = {
      host: "127.0.0.1",
      port: 0,
      logDir: await mkdtemp(join(tmpdir(), "writer-integration-logs-")),
      logLevel: "error",
      version: "test"
    };
    const state = await createTestState();
    const handler = createRequestHandler(config, state);

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
    const agentPayload = (await agents.json()) as { adapters: Array<{ id: string; available: boolean }> };
    const echo = agentPayload.adapters.find((adapter) => adapter.id === "echo");
    expect(echo?.available).toBe(true);
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
    const extraction = (await extractRes.json()) as { extraction: { nodes: unknown[] } };
    expect(extraction.extraction.nodes.length).toBeGreaterThan(0);
  });
});
