import type { DaemonCapability, McpServer } from "@writer/contracts";

import type { DaemonState } from "./state";

function getFigmaMcpCapability(figma: McpServer): DaemonCapability {
  if (!figma.enabled) {
    return { id: "figma-mcp", status: "disabled", message: "Not enabled" };
  }

  if (figma.status === "connected") {
    return { id: "figma-mcp", status: "enabled" };
  }

  const message =
    figma.diagnostic?.message ?? figma.errorMessage ?? `Figma MCP is ${figma.status}`;

  return { id: "figma-mcp", status: "degraded", message };
}

export function getDaemonCapabilities(state: DaemonState): DaemonCapability[] {
  return [
    { id: "desktop-shell", status: "enabled" },
    { id: "local-storage", status: "enabled" },
    { id: "agent-runtime", status: "enabled" },
    { id: "tool-runtime", status: "enabled" },
    getFigmaMcpCapability(state.mcp.figma)
  ];
}
