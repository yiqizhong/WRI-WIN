import type { ConnectionDiagnostic, McpConnectionStatus } from "@writer/contracts";

type ToolSummary = {
  name: string;
};

export function formatConnectionDiagnostic(diagnostic: ConnectionDiagnostic | undefined): string | null {
  if (!diagnostic) {
    return null;
  }

  const parts = [diagnostic.message];
  if (diagnostic.recoveryAction) {
    parts.push(diagnostic.recoveryAction);
  }
  return parts.join(" ");
}

export function formatConnectionDiagnosticTechnical(
  diagnostic: ConnectionDiagnostic | undefined
): string | null {
  if (!diagnostic) {
    return null;
  }

  const parts = [`${diagnostic.code} · ${diagnostic.message}`];
  if (diagnostic.recoveryAction) {
    parts.push(`Recovery: ${diagnostic.recoveryAction}`);
  }
  if (diagnostic.command) {
    parts.push(`Command: ${diagnostic.command}`);
  }
  return parts.join(" ");
}

export function mcpConnectionStatusLabel(status: McpConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Error";
  }
}

export function mcpConnectionStatusTagType(
  status: McpConnectionStatus
): "green" | "red" | "gray" {
  switch (status) {
    case "connected":
      return "green";
    case "error":
      return "red";
    case "connecting":
    case "disconnected":
      return "gray";
  }
}

export function summarizeMcpTools(tools: ToolSummary[] | undefined): string {
  if (!tools || tools.length === 0) {
    return "No tools discovered";
  }
  return tools.map((tool) => tool.name).join(", ");
}
