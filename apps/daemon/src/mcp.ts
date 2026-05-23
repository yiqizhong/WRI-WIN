import { z } from "zod";

import type { McpServer, McpServerList, McpSmokeResult } from "@writer/contracts";

import type { DaemonState } from "./state";
import { createMcpClient, type McpClientConfig } from "./mcp-client";
import {
  createFigmaOAuthProvider,
  createOAuthCallbackServer,
  FIGMA_MCP_DEFAULT_URL,
  type FigmaOAuthProvider,
  type OAuthCallbackServer
} from "./figma-mcp-oauth";
import { executeTool } from "./tools";

const toggleMcpInputSchema = z.object({
  enabled: z.boolean()
});

export type McpRuntimeState = {
  figma: McpServer;
  figmaClient?: ReturnType<typeof createMcpClient> | null;
  figmaOAuthProvider?: FigmaOAuthProvider | null;
  figmaOAuthCallbackServer?: OAuthCallbackServer | null;
  createClient?: typeof createMcpClient;
  env?: NodeJS.ProcessEnv;
};

export type FigmaMcpAuthStartResult = {
  ok: boolean;
  status: "connected" | "redirect" | "error";
  authorizationUrl?: string;
  diagnostic?: McpServer["diagnostic"];
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
      command: FIGMA_MCP_DEFAULT_URL,
      diagnostic: {
        code: "needs_auth",
        severity: "warning",
        message: "Figma MCP is ready to connect.",
        recoveryAction: "Enable Figma MCP, then click Connect Figma to sign in."
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
    await state.mcp.figmaOAuthCallbackServer?.stop();
    state.mcp.figmaClient = null;
    state.mcp.figmaOAuthProvider = null;
    state.mcp.figmaOAuthCallbackServer = null;
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
  const { client, oauthProvider } = createFigmaMcpClient(config, createClient);
  const connection = await client.connect();

  if (!connection.ok) {
    state.mcp.figmaClient = null;
    state.mcp.figmaOAuthProvider = oauthProvider ?? null;
    state.mcp.figma = {
      ...state.mcp.figma,
      enabled: true,
      status: connection.diagnostic?.code === "needs_auth" ? "disconnected" : "error",
      errorMessage: connection.diagnostic?.message,
      diagnostic: connection.diagnostic,
      command: config.url ?? config.command,
      tools: []
    };
    await appendMcpToggleAudit(state, serverId, parsed.enabled, Boolean(config.command || config.url));
    return state.mcp.figma;
  }

  const tools = await client.listTools();
  state.mcp.figmaClient = client;
  state.mcp.figmaOAuthProvider = oauthProvider ?? null;

  state.mcp.figma = {
    ...state.mcp.figma,
    enabled: true,
    status: "connected",
    command: config.url ?? config.command,
    errorMessage: undefined,
    diagnostic: {
      code: "ready",
      severity: "info",
      message: "Figma MCP connected."
    },
    tools
  };

  await appendMcpToggleAudit(state, serverId, parsed.enabled, Boolean(config.command || config.url));
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
  const remoteAuthToken = env.WRITER_FIGMA_MCP_AUTH_TOKEN;
  const command = env.WRITER_FIGMA_MCP_COMMAND;
  const url = command ? env.WRITER_FIGMA_MCP_URL : env.WRITER_FIGMA_MCP_URL ?? FIGMA_MCP_DEFAULT_URL;

  return {
    transport: url ? "http" : "stdio",
    url,
    command,
    args: parseArgs(env.WRITER_FIGMA_MCP_ARGS),
    env: {
      ...(env.FIGMA_ACCESS_TOKEN ? { FIGMA_ACCESS_TOKEN: env.FIGMA_ACCESS_TOKEN } : {})
    },
    headers: {
      ...(remoteAuthToken ? { Authorization: `Bearer ${remoteAuthToken}` } : {})
    },
    readToolName: env.WRITER_FIGMA_MCP_READ_TOOL
  };
}

export async function startFigmaMcpAuth(state: DaemonState): Promise<FigmaMcpAuthStartResult> {
  const config = getFigmaMcpConfigFromEnv(state.mcp.env);
  if (!config.url) {
    return {
      ok: false,
      status: "error",
      diagnostic: {
        code: "not_configured",
        severity: "warning",
        message: "Figma MCP remote URL is not configured.",
        recoveryAction: "Use the default remote Figma MCP server or set WRITER_FIGMA_MCP_URL."
      }
    };
  }

  const createClient = state.mcp.createClient ?? createMcpClient;
  const oauthProvider = createFigmaOAuthProvider();
  const { client } = createFigmaMcpClient({ ...config, authProvider: oauthProvider }, createClient);

  if (await oauthProvider.hasTokens()) {
    const connection = await client.connect();
    if (connection.ok) {
      return finalizeFigmaConnection(state, client, oauthProvider);
    }
  }

  const callbackServer = state.mcp.figmaOAuthCallbackServer ?? createOAuthCallbackServer();
  state.mcp.figmaOAuthCallbackServer = callbackServer;

  try {
    await callbackServer.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start OAuth callback server.";
    return {
      ok: false,
      status: "error",
      diagnostic: {
        code: "startup_failed",
        severity: "error",
        message: "Figma OAuth callback server failed to start.",
        recoveryAction: "Close other apps using port 19876 and try again.",
        stderrSnippet: message
      }
    };
  }

  const callbackPromise = callbackServer.waitForCallback();
  const connection = await client.connect();

  if (connection.ok) {
    return finalizeFigmaConnection(state, client, oauthProvider);
  }

  const authorizationUrl = oauthProvider.getPendingAuthorizationUrl()?.toString();
  if (connection.diagnostic?.code === "needs_auth" && authorizationUrl) {
    state.mcp.figmaClient = client;
    state.mcp.figmaOAuthProvider = oauthProvider;
    state.mcp.figma = {
      ...state.mcp.figma,
      enabled: true,
      status: "disconnected",
      command: config.url,
      diagnostic: {
        code: "needs_auth",
        severity: "warning",
        message: "Continue sign-in in your browser.",
        recoveryAction: "Complete Figma authorization, then return to Writer.",
        metadata: { authorizationUrl }
      }
    };

    void callbackPromise
      .then(async ({ code }) => {
        const finish = await client.finishAuth(code);
        if (!finish.ok) {
          state.mcp.figma = {
            ...state.mcp.figma,
            status: "error",
            diagnostic: finish.diagnostic
          };
          return;
        }

        await finalizeFigmaConnection(state, client, oauthProvider);
      })
      .catch(() => {
        state.mcp.figma = {
          ...state.mcp.figma,
          status: "error",
          diagnostic: {
            code: "smoke_failed",
            severity: "error",
            message: "Figma sign-in timed out or was cancelled.",
            recoveryAction: "Click Connect Figma and try again."
          }
        };
      })
      .finally(async () => {
        await callbackServer.stop();
        state.mcp.figmaOAuthCallbackServer = null;
      });

    return {
      ok: true,
      status: "redirect",
      authorizationUrl
    };
  }

  await callbackServer.stop();
  state.mcp.figmaOAuthCallbackServer = null;

  return {
    ok: false,
    status: "error",
    diagnostic: connection.diagnostic ?? {
      code: "startup_failed",
      severity: "error",
      message: "Could not start Figma MCP authentication.",
      recoveryAction: "Try Connect Figma again."
    }
  };
}

async function finalizeFigmaConnection(
  state: DaemonState,
  client: ReturnType<typeof createMcpClient>,
  oauthProvider: FigmaOAuthProvider
): Promise<FigmaMcpAuthStartResult> {
  const config = getFigmaMcpConfigFromEnv(state.mcp.env);
  const tools = await client.listTools();

  state.mcp.figmaClient = client;
  state.mcp.figmaOAuthProvider = oauthProvider;
  state.mcp.figma = {
    ...state.mcp.figma,
    enabled: true,
    status: "connected",
    command: config.url ?? config.command,
    errorMessage: undefined,
    diagnostic: {
      code: "ready",
      severity: "info",
      message: "Figma MCP connected."
    },
    tools
  };

  return {
    ok: true,
    status: "connected"
  };
}

function createFigmaMcpClient(
  config: McpClientConfig,
  createClient: typeof createMcpClient
): { client: ReturnType<typeof createMcpClient>; oauthProvider?: FigmaOAuthProvider } {
  const usesRemoteOAuth = config.transport === "http" && config.url && !config.headers?.Authorization;
  const oauthProvider =
    (config.authProvider as FigmaOAuthProvider | undefined) ??
    (usesRemoteOAuth ? createFigmaOAuthProvider() : undefined);

  return {
    client: createClient({
      ...config,
      authProvider: oauthProvider
    }),
    oauthProvider
  };
}

export async function smokeFigmaRead(state: DaemonState): Promise<McpSmokeResult> {
  const config = getFigmaMcpConfigFromEnv(state.mcp.env);

  if (!config.command && !config.url && !state.mcp.figmaClient && state.mcp.figma.status !== "connected") {
    return {
      ok: false,
      serverId: "figma",
      diagnostic: {
        code: "not_configured",
        severity: "warning",
        message: "Figma MCP is not configured.",
        recoveryAction:
          "Set WRITER_FIGMA_MCP_URL for remote HTTP, or WRITER_FIGMA_MCP_COMMAND and optional WRITER_FIGMA_MCP_ARGS for stdio."
      }
    };
  }

  const tools = state.mcp.figma.tools ?? [];

  if (!state.mcp.figmaClient) {
    return {
      ok: false,
      serverId: "figma",
      diagnostic: {
        code: "startup_failed",
        severity: "error",
        message: "Figma MCP server is not connected.",
        recoveryAction: "Click Connect Figma before running read smoke.",
        command: config.url ?? config.command
      },
      metadata: {
        tools: tools.map((tool) => tool.name)
      }
    };
  }

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

const FIGMA_MCP_SMOKE_TOOL_PRIORITY = [
  "whoami",
  "get_metadata",
  "get_screenshot",
  "get_design_context",
  "get_variable_defs",
  "get_figjam"
] as const;

function findReadToolName(tools: string[]): string | undefined {
  for (const preferred of FIGMA_MCP_SMOKE_TOOL_PRIORITY) {
    if (tools.includes(preferred)) {
      return preferred;
    }
  }

  return (
    tools.find((name) => /(^|_|\.)get(_|\.)?file/i.test(name)) ??
    tools.find((name) => /^(get_|read_)/i.test(name)) ??
    tools.find((name) => /read|metadata|screenshot|context/i.test(name) && !isWriteLikeMcpTool(name))
  );
}

function isWriteLikeMcpTool(name: string): boolean {
  return /create|write|upload|generate|use_figma|add_|send_|delete|remove/i.test(name);
}
