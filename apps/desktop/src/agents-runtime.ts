import {
  LOCAL_MODEL_ADAPTER_IDS,
  LLM_PROVIDER_ADAPTER_IDS,
  type AgentAdapter,
  type AgentAdapterList,
  type McpServer
} from "@writer/contracts";

export type AgentsLoadState = "idle" | "loading" | "ready";

export function isFigmaMcpConnected(servers: McpServer[]): boolean {
  return servers.find((s) => s.id === "figma")?.status === "connected";
}

export const LLM_PROVIDER_PLACEHOLDERS: AgentAdapter[] = [
  {
    id: "devin",
    displayName: "Devin",
    available: false,
    runtimeKind: "hybrid",
    capabilities: []
  }
];

export const MCP_SERVER_PLACEHOLDERS: McpServer[] = [
  {
    id: "figma",
    name: "Figma MCP",
    enabled: false,
    status: "disconnected",
    capabilities: ["figma.read", "figma.write"],
    diagnostic: {
      code: "needs_auth",
      severity: "warning",
      message: "Figma MCP is ready to connect.",
      recoveryAction: "Enable Figma MCP, then click Connect Figma to sign in."
    }
  }
];

/** Keep UI labels aligned with placeholders even if daemon returns older displayNames. */
function canonicalizeLlmDisplay(adapter: AgentAdapter): AgentAdapter {
  const preset = LLM_PROVIDER_PLACEHOLDERS.find((p) => p.id === adapter.id);
  return preset ? { ...adapter, displayName: preset.displayName } : adapter;
}

export function mergeLlmAdapters(
  current: AgentAdapter[],
  fetched: AgentAdapter[]
): AgentAdapter[] {
  return LLM_PROVIDER_ADAPTER_IDS.map((id) => {
    const next = fetched.find((adapter) => adapter.id === id);
    const previous = current.find((adapter) => adapter.id === id);
    const merged = next ?? previous ?? LLM_PROVIDER_PLACEHOLDERS.find((adapter) => adapter.id === id)!;
    return canonicalizeLlmDisplay(merged);
  });
}

export const LOCAL_MODEL_PLACEHOLDERS: AgentAdapter[] = [
  {
    id: "local-gemma",
    displayName: "Gemma 4 12B",
    available: false,
    runtimeKind: "local",
    capabilities: []
  }
];

export function mergeLocalModelAdapters(
  current: AgentAdapter[],
  fetched: AgentAdapter[]
): AgentAdapter[] {
  return LOCAL_MODEL_ADAPTER_IDS.map((id) => {
    const next = fetched.find((a) => a.id === id);
    const previous = current.find((a) => a.id === id);
    return next ?? previous ?? LOCAL_MODEL_PLACEHOLDERS.find((a) => a.id === id)!;
  });
}

export function mergeMcpServers(current: McpServer[], fetched: McpServer[]): McpServer[] {
  const figma =
    fetched.find((server) => server.id === "figma") ??
    current.find((server) => server.id === "figma") ??
    MCP_SERVER_PLACEHOLDERS[0]!;

  return [figma];
}

export function applyAgentAdapterList(
  current: AgentAdapter[],
  list: AgentAdapterList
): { llmAdapters: AgentAdapter[]; localModelAdapters: AgentAdapter[]; activeAdapterId: string | null } {
  return {
    llmAdapters: mergeLlmAdapters(current, list.adapters),
    localModelAdapters: mergeLocalModelAdapters(current, list.adapters),
    activeAdapterId: list.activeAdapterId
  };
}

/**
 * Decide the active adapter id after a background agent-list load resolves.
 *
 * Guards the race where a slow `listAgents()` started before the user picked a
 * provider resolves afterwards carrying a stale (load-time) active id. Once the
 * user has made an explicit choice, that choice wins over the late load.
 */
export function resolveActiveAfterLoad(input: {
  loadedActiveId: string | null;
  currentActiveId: string | null;
  userHasChosen: boolean;
}): string | null {
  if (input.userHasChosen) {
    return input.currentActiveId;
  }
  return input.loadedActiveId;
}

export function isAdapterStatusLoading(
  adapter: AgentAdapter,
  loadState: AgentsLoadState,
  refreshing: boolean,
  connected: boolean
): boolean {
  if (!connected) {
    return false;
  }

  if (loadState === "idle") {
    return true;
  }

  if (loadState === "loading" || refreshing) {
    return !adapter.setupMessage && !adapter.executablePath && !adapter.diagnostic;
  }

  return false;
}
