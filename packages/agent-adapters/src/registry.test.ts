import { describe, expect, it } from "vitest";

import { createDefaultAgentRegistry } from "./index";

describe("AgentAdapterRegistry", () => {
  it("registers echo and provider adapters", async () => {
    const registry = createDefaultAgentRegistry();
    const adapters = registry.list();

    expect(adapters.length).toBeGreaterThanOrEqual(5);

    const echo = registry.get("echo");
    const echoDetection = await echo!.detect();
    expect(echoDetection.adapter.available).toBe(true);

    const codex = registry.get("codex");
    expect(codex).toBeDefined();
    const codexDetection = await codex!.detect();
    expect(codexDetection.adapter.id).toBe("codex");
    expect(typeof codexDetection.adapter.available).toBe("boolean");

    const devin = registry.get("devin");
    const devinDetection = await devin!.detect();
    expect(devinDetection.adapter.runtimeKind).toBe("hybrid");
  });
});
