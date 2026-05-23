export { AgentAdapterRegistry } from "./registry";
export { createStubAdapter } from "./stub-adapter";
export type {
  AgentAdapterImplementation,
  AgentDetectionResult,
  AgentRunHandle,
  AgentRunRequest
} from "./types";

import { AgentAdapterRegistry } from "./registry";
import { createStubAdapter } from "./stub-adapter";

export function createDefaultAgentRegistry(): AgentAdapterRegistry {
  const registry = new AgentAdapterRegistry();
  registry.register(createStubAdapter("codex", "Codex"));
  registry.register(createStubAdapter("cursor-agent", "Cursor Agent"));
  return registry;
}
