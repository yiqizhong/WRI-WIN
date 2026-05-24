import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { describe, expect, it } from "vitest";

import { createDefaultMcpState } from "./mcp";
import { runFigmaWriteback } from "./review-queue";
import { seedDemoChange } from "./review";
import type { DaemonState } from "./state";

async function createTestState(): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-figma-writeback-"));
  const store = new PlatformStore({ dataDir });
  await store.load();

  return {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: createDefaultMcpState()
  };
}

describe("runFigmaWriteback", () => {
  it("skips proposed changes", async () => {
    const state = await createTestState();
    const timestamp = new Date().toISOString();
    const session = state.store.upsertSession({
      id: "sess-figma",
      projectId: "proj-1",
      sourceType: "figma",
      scope: {
        fileKey: "abc123",
        suggestedScope: { kind: "frame", fileKey: "abc123", nodeId: "1:10" }
      },
      status: "reviewing",
      agentRunIds: [],
      createdAt: timestamp,
      updatedAt: timestamp
    });

    const change = state.store.upsertReviewChange({
      id: "chg-proposed",
      sessionId: session.id,
      sourceId: "1:11",
      status: "proposed",
      before: "Click here",
      after: "View details",
      rationale: "test",
      updatedAt: timestamp,
      updatedBy: "user"
    });

    const result = await runFigmaWriteback(state, {
      sessionId: session.id,
      changeIds: [change.id]
    });

    expect(result.results[0]?.status).toBe("skipped");
  });

  it("requires permission before calling MCP write", async () => {
    const state = await createTestState();
    const timestamp = new Date().toISOString();
    const session = state.store.upsertSession({
      id: "sess-figma",
      projectId: "proj-1",
      sourceType: "figma",
      scope: {
        fileKey: "abc123",
        suggestedScope: { kind: "frame", fileKey: "abc123", nodeId: "1:10" }
      },
      status: "reviewing",
      agentRunIds: [],
      createdAt: timestamp,
      updatedAt: timestamp
    });
    const change = await seedDemoChange(state, session.id);

    const result = await runFigmaWriteback(state, {
      sessionId: session.id,
      changeIds: [change.id]
    });

    expect(result.permissionRequestId).toBeTruthy();
    expect(result.results[0]?.status).toBe("failed");
  });

  it("writes approved changes through use_figma when permitted", async () => {
    const state = await createTestState();
    state.mcp.figma.enabled = true;
    state.mcp.figma.status = "connected";
    state.mcp.figmaClient = {
      connect: async () => ({ ok: true }),
      listTools: async () => [{ name: "use_figma" }],
      callTool: async (name: string) => ({
        ok: true,
        result: {
          content: [{ type: "text", text: JSON.stringify({ mutatedNodeIds: ["node-primary"] }) }]
        }
      }),
      finishAuth: async () => ({ ok: true }),
      close: async () => undefined
    };

    const timestamp = new Date().toISOString();
    const session = state.store.upsertSession({
      id: "sess-figma",
      projectId: "proj-1",
      sourceType: "figma",
      scope: {
        fileKey: "abc123",
        suggestedScope: { kind: "frame", fileKey: "abc123", nodeId: "1:10" }
      },
      status: "reviewing",
      agentRunIds: [],
      createdAt: timestamp,
      updatedAt: timestamp
    });
    const change = await seedDemoChange(state, session.id);

    state.permissionRequests.push({
      id: "perm-1",
      toolId: "figma.write",
      toolName: "Write Figma text",
      risk: "write",
      sessionId: session.id,
      reason: "Apply",
      decision: "approved",
      decidedAt: timestamp,
      decidedBy: "user"
    });

    const result = await runFigmaWriteback(state, {
      sessionId: session.id,
      changeIds: [change.id],
      permissionRequestId: "perm-1"
    });

    expect(result.results[0]?.status).toBe("applied");
    expect(state.store.getReviewChange(change.id)?.status).toBe("applied");
  });
});
