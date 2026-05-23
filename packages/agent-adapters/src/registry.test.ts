import { describe, expect, it } from "vitest";

import { createDefaultAgentRegistry } from "./index";

describe("AgentAdapterRegistry", () => {
  it("registers default stub adapters", async () => {
    const registry = createDefaultAgentRegistry();
    const adapters = registry.list();

    expect(adapters).toHaveLength(2);

    const detection = await adapters[0]!.detect();
    expect(detection.adapter.available).toBe(false);
  });
});
