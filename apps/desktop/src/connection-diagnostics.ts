import type { ConnectionDiagnostic } from "@writer/contracts";

type ToolSummary = {
  name: string;
};

export function formatConnectionDiagnostic(diagnostic: ConnectionDiagnostic | undefined): string | null {
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

export function summarizeMcpTools(tools: ToolSummary[] | undefined): string {
  if (!tools || tools.length === 0) {
    return "No tools discovered";
  }
  return tools.map((tool) => tool.name).join(", ");
}
