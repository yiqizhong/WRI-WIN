import { z } from "zod";

import type { McpServer, McpServerList } from "@writer/contracts";

import type { DaemonState } from "./state";
import { executeTool } from "./tools";

const toggleMcpInputSchema = z.object({
  enabled: z.boolean()
});

export type McpRuntimeState = {
  figma: McpServer;
};

export function createDefaultMcpState(): McpRuntimeState {
  return {
    figma: {
      id: "figma",
      name: "Figma MCP",
      enabled: false,
      status: "disconnected",
      capabilities: ["figma.read", "figma.write"],
      errorMessage: process.env.FIGMA_ACCESS_TOKEN ? undefined : "Set FIGMA_ACCESS_TOKEN to enable smoke checks."
    }
  };
}

export function getMcpServerList(state: DaemonState): McpServerList {
  return { servers: [state.mcp.figma] };
}

export async function setMcpServerEnabled(state: DaemonState, serverId: string, input: unknown): Promise<McpServer> {
  if (serverId !== "figma") {
    throw new Error("Unknown MCP server");
  }

  const parsed = toggleMcpInputSchema.parse(input);
  const configured = Boolean(process.env.FIGMA_ACCESS_TOKEN);

  state.mcp.figma = {
    ...state.mcp.figma,
    enabled: parsed.enabled,
    status: parsed.enabled ? (configured ? "connected" : "error") : "disconnected",
    errorMessage: parsed.enabled && !configured ? "Set FIGMA_ACCESS_TOKEN to connect Figma MCP." : undefined
  };

  state.store.appendAuditEntry({
    type: "tool_attempt",
    timestamp: new Date().toISOString(),
    actor: "user",
    summary: `MCP figma ${parsed.enabled ? "enabled" : "disabled"}`,
    details: { serverId, enabled: parsed.enabled, configured }
  });
  await state.store.save();

  return state.mcp.figma;
}

export function smokeFigmaRead(state: DaemonState): { ok: boolean; configured: boolean; metadata: Record<string, unknown> } {
  const configured = Boolean(process.env.FIGMA_ACCESS_TOKEN);
  const server = state.mcp.figma;

  return {
    ok: server.enabled || configured,
    configured,
    metadata: {
      serverId: "figma",
      status: server.status,
      enabled: server.enabled,
      smoke: "read_metadata",
      note: configured
        ? "Figma token present; full MCP handshake deferred to integration setup."
        : "No FIGMA_ACCESS_TOKEN; returning bootstrap smoke payload only."
    }
  };
}

export async function smokeFigmaWrite(
  state: DaemonState,
  input: { sessionId: string; permissionRequestId?: string }
): Promise<{ ok: boolean; permissionRequestId?: string; result?: unknown }> {
  const execution = await executeTool(state, {
    toolId: "figma.write",
    sessionId: input.sessionId,
    args: { action: "smoke_write_text" }
  });

  if (!execution.ok) {
    return { ok: false, permissionRequestId: execution.permissionRequestId };
  }

  if (input.permissionRequestId) {
    const approved = state.permissionRequests.find(
      (request) => request.id === input.permissionRequestId && request.decision === "approved"
    );

    if (!approved) {
      return { ok: false, permissionRequestId: input.permissionRequestId };
    }
  }

  const configured = Boolean(process.env.FIGMA_ACCESS_TOKEN);

  state.store.appendAuditEntry({
    type: "tool_attempt",
    timestamp: new Date().toISOString(),
    actor: "system",
    summary: "Figma MCP write smoke",
    details: {
      configured,
      action: "smoke_write_text",
      sessionId: input.sessionId
    }
  });
  await state.store.save();

  return {
    ok: true,
    result: {
      smoke: "write_text",
      configured,
      applied: configured,
      message: configured
        ? "Write smoke recorded with credentials present."
        : "Write smoke recorded in dry-run mode without credentials."
    }
  };
}
