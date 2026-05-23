import { z } from "zod";

import type { McpServer, McpServerList, McpSmokeResult } from "@writer/contracts";

import type { DaemonState } from "./state";
import { createMcpClient, type McpClientConfig } from "./mcp-client";
import { executeTool } from "./tools";

const toggleMcpInputSchema = z.object({
  enabled: z.boolean()
});

export type McpRuntimeState = {
  figma: McpServer;
  figmaClient?: ReturnType<typeof createMcpClient> | null;
  createClient?: typeof createMcpClient;
  env?: NodeJS.ProcessEnv;
};

export function createDefaultMcpState(options: { env?: NodeJS.ProcessEnv; createClient?: typeof createMcpClient } = {}): McpRuntimeState {
  return {
    env: options.env,
    createClient: options.createClient,
    figmaClient: null,
    figma: {
      id: "figma",
      name: "Figma MCP",
      enabled: false,
      status: "disconnected",
      capabilities: ["figma.read", "figma.write"],
      diagnostic: {
        code: "not_configured",
        severity: "warning",
        message: "Figma MCP command is not configured.",
        recoveryAction: "Set WRITER_FIGMA_MCP_COMMAND and optional WRITER_FIGMA_MCP_ARGS."
      }
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

  if (!parsed.enabled) {
    await state.mcp.figmaClient?.close();
    state.mcp.figmaClient = null;
    state.mcp.figma = {
      ...state.mcp.figma,
      enabled: false,
      status: "disconnected",
      errorMessage: undefined,
      diagnostic: undefined
    };
    await appendMcpToggleAudit(state, serverId, parsed.enabled, false);
    return state.mcp.figma;
  }

  const config = getFigmaMcpConfigFromEnv(state.mcp.env);
  const createClient = state.mcp.createClient ?? createMcpClient;
  const client = createClient(config);
  const connection = await client.connect();

  if (!connection.ok) {
    state.mcp.figmaClient = null;
    state.mcp.figma = {
      ...state.mcp.figma,
      enabled: true,
      status: "error",
      errorMessage: connection.diagnostic?.message,
      diagnostic: connection.diagnostic,
      command: config.command,
      tools: []
    };
    await appendMcpToggleAudit(state, serverId, parsed.enabled, Boolean(config.command));
    return state.mcp.figma;
  }

  const tools = await client.listTools();
  state.mcp.figmaClient = client;

  state.mcp.figma = {
    ...state.mcp.figma,
    enabled: true,
    status: "connected",
    command: config.command,
    errorMessage: undefined,
    diagnostic: {
      code: "ready",
      severity: "info",
      message: "Figma MCP connected."
    },
    tools
  };

  await appendMcpToggleAudit(state, serverId, parsed.enabled, Boolean(config.command));
  return state.mcp.figma;
}

async function appendMcpToggleAudit(
  state: DaemonState,
  serverId: string,
  enabled: boolean,
  configured: boolean
): Promise<void> {
  state.store.appendAuditEntry({
    type: "tool_attempt",
    timestamp: new Date().toISOString(),
    actor: "user",
    summary: `MCP figma ${enabled ? "enabled" : "disabled"}`,
    details: { serverId, enabled, configured }
  });
  await state.store.save();
}

export function getFigmaMcpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): McpClientConfig & { readToolName?: string } {
  return {
    command: env.WRITER_FIGMA_MCP_COMMAND,
    args: parseArgs(env.WRITER_FIGMA_MCP_ARGS),
    env: {
      ...(env.FIGMA_ACCESS_TOKEN ? { FIGMA_ACCESS_TOKEN: env.FIGMA_ACCESS_TOKEN } : {})
    },
    readToolName: env.WRITER_FIGMA_MCP_READ_TOOL
  };
}

export async function smokeFigmaRead(state: DaemonState): Promise<McpSmokeResult> {
  const config = getFigmaMcpConfigFromEnv(state.mcp.env);

  if (!config.command && !state.mcp.figmaClient && state.mcp.figma.status !== "connected") {
    return {
      ok: false,
      serverId: "figma",
      diagnostic: {
        code: "not_configured",
        severity: "warning",
        message: "Figma MCP command is not configured.",
        recoveryAction: "Set WRITER_FIGMA_MCP_COMMAND and optional WRITER_FIGMA_MCP_ARGS."
      }
    };
  }

  const tools = state.mcp.figma.tools ?? [];
  const toolName = config.readToolName ?? findReadToolName(tools.map((tool) => tool.name));

  if (!toolName) {
    return {
      ok: false,
      serverId: "figma",
      diagnostic: {
        code: "tool_not_found",
        severity: "error",
        message: "No read-capable Figma MCP tool is configured or discovered.",
        recoveryAction: "Set WRITER_FIGMA_MCP_READ_TOOL to one of the discovered read tools."
      },
      metadata: {
        tools: tools.map((tool) => tool.name)
      }
    };
  }

  if (!state.mcp.figmaClient) {
    return {
      ok: false,
      serverId: "figma",
      diagnostic: {
        code: "startup_failed",
        severity: "error",
        message: "Figma MCP server is not connected.",
        recoveryAction: "Enable Figma MCP before running read smoke.",
        command: config.command
      },
      metadata: {
        tools: tools.map((tool) => tool.name)
      }
    };
  }

  const result = await state.mcp.figmaClient.callTool(toolName, {});

  return {
    ok: result.ok,
    serverId: "figma",
    toolName,
    diagnostic: result.diagnostic,
    result: result.result,
    metadata: {
      tools: tools.map((tool) => tool.name)
    }
  };
}

export async function smokeFigmaWrite(
  state: DaemonState,
  input: { sessionId: string; permissionRequestId?: string; changeId?: string }
): Promise<{ ok: boolean; permissionRequestId?: string; result?: unknown }> {
  const execution = await executeTool(state, {
    toolId: "figma.write",
    sessionId: input.sessionId,
    changeId: input.changeId,
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

function parseArgs(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
  } catch {
    // Fall back to whitespace splitting below.
  }

  return value.split(/\s+/).filter(Boolean);
}

function findReadToolName(tools: string[]): string | undefined {
  return tools.find((name) => /(^|_|\.)get(_|\.)?file/i.test(name)) ?? tools.find((name) => /read|file|node/i.test(name));
}
