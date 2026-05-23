import type { DaemonCapability } from "@writer/contracts";

export function getBootstrapCapabilities(): DaemonCapability[] {
  return [
    { id: "desktop-shell", status: "enabled" },
    { id: "local-storage", status: "enabled" },
    { id: "agent-runtime", status: "enabled" },
    { id: "tool-runtime", status: "enabled" },
    { id: "figma-mcp", status: "degraded", message: "Not configured" }
  ];
}
