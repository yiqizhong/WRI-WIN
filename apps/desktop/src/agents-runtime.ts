import {
  LOCAL_MODEL_ADAPTER_IDS,
  LLM_PROVIDER_ADAPTER_IDS,
  type AgentAdapter,
  type AgentAdapterList,
  type McpServer
} from "@writer/contracts";

export type AgentsLoadState = "idle" | "loading" | "ready";

export const LLM_PROVIDER_PLACEHOLDERS: AgentAdapter[] = [
  {
    id: "cursor-agent",
    displayName: "Cursor",
    available: false,
    runtimeKind: "local",
    capabilities: []
  },
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
    displayName: "Gemma 4 E4B",
    available: false,
    runtimeKind: "local",
    capabilities: []
  }
];

/** Keep UI labels aligned with placeholders. */
function canonicalizeLocalModelDisplay(adapter: AgentAdapter): AgentAdapter {
  const preset = LOCAL_MODEL_PLACEHOLDERS.find((p) => p.id === adapter.id);
  return preset ? { ...adapter, displayName: preset.displayName } : adapter;
}

export function mergeLocalModelAdapters(
  current: AgentAdapter[],
  fetched: AgentAdapter[]
): AgentAdapter[] {
  return LOCAL_MODEL_ADAPTER_IDS.map((id) => {
    const next = fetched.find((a) => a.id === id);
    const previous = current.find((a) => a.id === id);
    const merged = next ?? previous ?? LOCAL_MODEL_PLACEHOLDERS.find((a) => a.id === id)!;
    return canonicalizeLocalModelDisplay(merged);
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
