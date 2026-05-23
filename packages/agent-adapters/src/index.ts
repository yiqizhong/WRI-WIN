export { AgentAdapterRegistry } from "./registry";
export { createEchoAdapter } from "./echo-adapter";
export { createStubAdapter } from "./stub-adapter";
export type {
  AgentAdapterImplementation,
  AgentDetectionResult,
  AgentRunHandle,
  AgentRunRequest
} from "./types";

import { AgentAdapterRegistry } from "./registry";
import { createEchoAdapter } from "./echo-adapter";
import { createStubAdapter } from "./stub-adapter";

export function createDefaultAgentRegistry(): AgentAdapterRegistry {
  const registry = new AgentAdapterRegistry();
  registry.register(createEchoAdapter());
  registry.register(createStubAdapter("codex", "Codex"));
  registry.register(createStubAdapter("cursor-agent", "Cursor Agent"));
  return registry;
}
