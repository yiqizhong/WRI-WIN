import { parseDaemonHealth, type DaemonHealth } from "@writer/contracts";

export type DaemonConnectionState =
  | { kind: "checking" }
  | { kind: "connected"; health: DaemonHealth }
  | { kind: "degraded"; health: DaemonHealth }
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

export type DaemonStatusView = {
  label: string;
  tone: "checking" | "ready" | "warning" | "offline";
  detail: string;
};

export function getDaemonStatusView(state: DaemonConnectionState): DaemonStatusView {
  if (state.kind === "checking") {
    return {
      label: "Checking daemon",
      tone: "checking",
      detail: "Connecting to the local platform runtime."
    };
  }

  if (state.kind === "unavailable") {
    return {
      label: "Daemon unavailable",
      tone: "offline",
      detail: "Start the local daemon to enable agents, MCP, files, and writeback."
    };
  }

  if (state.kind === "error") {
    return {
      label: "Daemon error",
      tone: "offline",
      detail: state.message
    };
  }

  const enabledCount = state.health.capabilities.filter(
    (capability) => capability.status === "enabled"
  ).length;
  const capabilityLabel = enabledCount === 1 ? "capability" : "capabilities";

  if (state.kind === "degraded" || state.health.status === "degraded") {
    return {
      label: "Daemon degraded",
      tone: "warning",
      detail: `Version ${state.health.version} · ${enabledCount} ${capabilityLabel} enabled`
    };
  }

  return {
    label: "Daemon connected",
    tone: "ready",
    detail: `Version ${state.health.version} · ${enabledCount} ${capabilityLabel} enabled`
  };
}

export async function checkDaemonHealth(endpoint = "http://127.0.0.1:47631/health") {
  try {
    const response = await fetch(endpoint);

    if (!response.ok) {
      return { kind: "error", message: `Daemon returned HTTP ${response.status}` } satisfies DaemonConnectionState;
    }

    const health = parseDaemonHealth(await response.json());

    return {
      kind: health.status === "degraded" ? "degraded" : "connected",
      health
    } satisfies DaemonConnectionState;
  } catch {
    return { kind: "unavailable" } satisfies DaemonConnectionState;
  }
}

