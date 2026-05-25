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
  infoTooltip: string;
};

const DAEMON_INFO_CONNECTED =
  "The Writer local service is running on 127.0.0.1:47631 to manage your guidelines, LLM agents, MCP servers, and review workflows.\n\nThe desktop app connects automatically—no manual startup required.";

const DAEMON_INFO_CHECKING =
  "Connecting to Writer's local platform service, which handles guidelines, agents, MCP, and review runs on your machine.";

const DAEMON_INFO_UNAVAILABLE =
  "Writer needs the local daemon to upload guidelines, run LLM agents, and use MCP tools. Reopen the app to start it automatically, or run npm run dev:daemon.";

const DAEMON_INFO_ERROR =
  "The desktop app could not reach the local daemon. Quit and reopen Writer, or start it with npm run dev:daemon.";

const DAEMON_INFO_DEGRADED =
  "The daemon is running, but one or more capabilities need attention (for example MCP sign-in). Use Refresh after fixing the issue.";

export function getDaemonStatusView(state: DaemonConnectionState): DaemonStatusView {
  if (state.kind === "checking") {
    return {
      label: "Checking daemon",
      tone: "checking",
      detail: "Connecting to the local platform runtime.",
      infoTooltip: DAEMON_INFO_CHECKING
    };
  }

  if (state.kind === "unavailable") {
    return {
      label: "Daemon unavailable",
      tone: "offline",
      detail: "Waiting for the local platform runtime. Quit and reopen the app, or run npm run dev:daemon.",
      infoTooltip: DAEMON_INFO_UNAVAILABLE
    };
  }

  if (state.kind === "error") {
    return {
      label: "Daemon error",
      tone: "offline",
      detail: state.message,
      infoTooltip: DAEMON_INFO_ERROR
    };
  }

  const degradedCapabilities = state.health.capabilities.filter(
    (capability) => capability.status === "degraded"
  );
  const enabledCount = state.health.capabilities.filter(
    (capability) => capability.status === "enabled"
  ).length;
  const capabilityLabel = enabledCount === 1 ? "capability" : "capabilities";

  if (state.kind === "degraded" || state.health.status === "degraded") {
    const degradedDetail =
      degradedCapabilities.length > 0
        ? degradedCapabilities
            .map((capability) => capability.message ?? capability.id)
            .join(" · ")
        : null;

    return {
      label: "Daemon degraded",
      tone: "warning",
      detail:
        degradedDetail ??
        `Version ${state.health.version} · ${enabledCount} ${capabilityLabel} enabled`,
      infoTooltip: DAEMON_INFO_DEGRADED
    };
  }

  return {
    label: "Daemon connected",
    tone: "ready",
    detail: `Version ${state.health.version} · ${enabledCount} ${capabilityLabel} enabled`,
    infoTooltip: DAEMON_INFO_CONNECTED
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

