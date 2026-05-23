import type { AgentAdapterImplementation } from "./types";

export class AgentAdapterRegistry {
  private readonly adapters = new Map<string, AgentAdapterImplementation>();

  register(adapter: AgentAdapterImplementation): void {
    this.adapters.set(adapter.id, adapter);
  }

  list(): AgentAdapterImplementation[] {
    return [...this.adapters.values()];
  }

  get(id: string): AgentAdapterImplementation | undefined {
    return this.adapters.get(id);
  }
}
