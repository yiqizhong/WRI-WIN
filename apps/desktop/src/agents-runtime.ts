import { LLM_PROVIDER_ADAPTER_IDS, type AgentAdapter, type AgentAdapterList } from "@writer/contracts";

export type AgentsLoadState = "idle" | "loading" | "ready";

export const LLM_PROVIDER_PLACEHOLDERS: AgentAdapter[] = [
  {
    id: "cursor-agent",
    displayName: "Cursor Agent",
    available: false,
    runtimeKind: "local",
    capabilities: []
  },
  {
    id: "devin",
    displayName: "Devin (cloud-backed)",
    available: false,
    runtimeKind: "hybrid",
    capabilities: []
  }
];

export function mergeLlmAdapters(
  current: AgentAdapter[],
  fetched: AgentAdapter[]
): AgentAdapter[] {
  return LLM_PROVIDER_ADAPTER_IDS.map((id) => {
    const next = fetched.find((adapter) => adapter.id === id);
    const previous = current.find((adapter) => adapter.id === id);
    return next ?? previous ?? LLM_PROVIDER_PLACEHOLDERS.find((adapter) => adapter.id === id)!;
  });
}

export function applyAgentAdapterList(
  current: AgentAdapter[],
  list: AgentAdapterList
): { adapters: AgentAdapter[]; activeAdapterId: string | null } {
  return {
    adapters: mergeLlmAdapters(current, list.adapters),
    activeAdapterId: list.activeAdapterId
  };
}

export function isAdapterStatusLoading(
  adapter: AgentAdapter,
  loadState: AgentsLoadState,
  refreshing: boolean
): boolean {
  if (loadState === "idle") {
    return true;
  }

  if (loadState === "loading" || refreshing) {
    return !adapter.setupMessage && !adapter.executablePath && !adapter.diagnostic;
  }

  return false;
}
