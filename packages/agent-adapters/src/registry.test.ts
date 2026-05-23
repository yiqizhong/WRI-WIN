import { describe, expect, it } from "vitest";

import { createDefaultAgentRegistry } from "./index";

describe("AgentAdapterRegistry", () => {
  it("registers echo and stub adapters", async () => {
    const registry = createDefaultAgentRegistry();
    const adapters = registry.list();

    expect(adapters).toHaveLength(3);

    const echo = registry.get("echo");
    const echoDetection = await echo!.detect();
    expect(echoDetection.adapter.available).toBe(true);

    const codex = registry.get("codex");
    const codexDetection = await codex!.detect();
    expect(codexDetection.adapter.available).toBe(false);
  });
});
