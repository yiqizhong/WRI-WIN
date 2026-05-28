import type { McpCallToolResult } from "@writer/contracts";
import type { McpCaller, McpCallerStatus } from "@writer/review-core";

import type { DaemonState } from "./state";

export function createFigmaMcpCaller(state: DaemonState): McpCaller {
  const status = resolveMcpCallerStatus(state);

  return {
    status,
    callTool: (name, args) => callFigmaTool(state, name, args)
  };
}

function resolveMcpCallerStatus(state: DaemonState): McpCallerStatus {
  if (state.mcp.figma.status === "connected" && state.mcp.figmaClient) {
    return "connected";
  }

  if (state.mcp.figma.status === "error") {
    return "error";
  }

  return "disconnected";
}

async function callFigmaTool(
  state: DaemonState,
  name: string,
  args: Record<string, unknown>
): Promise<McpCallToolResult> {
  if (!state.mcp.figmaClient) {
    return {
      ok: false,
      diagnostic: {
        code: "mcp_not_ready",
        severity: "warning",
        message: "Figma MCP is not connected.",
        recoveryAction: "Open Agents and connect Figma MCP before running extraction."
      }
    };
  }

  const result = await state.mcp.figmaClient.callTool(name, args);

  // When auth expires mid-session the MCP client tears down its internal
  // protocol client and returns needs_auth. Mirror that in daemon state so the
  // UI stops showing "Connected" and prompts the user to re-authenticate.
  if (!result.ok && result.diagnostic?.code === "needs_auth") {
    state.mcp.figmaClient = null;
    state.mcp.figma = {
      ...state.mcp.figma,
      status: "disconnected",
      diagnostic: result.diagnostic
    };
  }

  return result;
}
