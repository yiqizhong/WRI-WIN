export { AgentAdapterRegistry } from "./registry";
export { createEchoAdapter } from "./echo-adapter";
export { createStubAdapter } from "./stub-adapter";
export { createCliAdapter, detectCliAdapter, smokeCliAdapter } from "./create-cli-adapter";
export { getCliAdapterConfig, createProviderAdapters, CLI_ADAPTER_IDS } from "./adapter-configs";
export { commandExists, runCliCommand } from "./cli-runner";
export type {
  AgentAdapterImplementation,
  AgentDetectionResult,
  AgentRunHandle,
  AgentRunRequest
} from "./types";
export type { CliAdapterConfig, AgentAuthState, AgentRuntimeKind } from "./create-cli-adapter";

import { AgentAdapterRegistry } from "./registry";
import { createProviderAdapters } from "./adapter-configs";
import { createEchoAdapter } from "./echo-adapter";

export function createDefaultAgentRegistry(): AgentAdapterRegistry {
  const registry = new AgentAdapterRegistry();
  const useStubsOnly = process.env.WRITER_AGENT_STUBS === "1";

  if (useStubsOnly) {
    registry.register(createEchoAdapter());
    return registry;
  }

  registry.register(createEchoAdapter());
  for (const adapter of createProviderAdapters()) {
    registry.register(adapter);
  }

  return registry;
}
