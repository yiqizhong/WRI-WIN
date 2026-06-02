import { describe, expect, it } from "vitest";

import { createDefaultAgentRegistry } from "./index";

describe("AgentAdapterRegistry", () => {
  // Detection spawns real `where`/CLI subprocesses for echo and devin; under
  // full-suite parallelism this can exceed the 5s default.
  it("registers echo and provider adapters", { timeout: 20_000 }, async () => {
    const registry = createDefaultAgentRegistry();
    const adapters = registry.list();

    expect(adapters.length).toBe(2);

    const echo = registry.get("echo");
    const echoDetection = await echo!.detect();
    expect(echoDetection.adapter.available).toBe(true);

    expect(registry.get("cursor-agent")).toBeUndefined();

    const devin = registry.get("devin");
    const devinDetection = await devin!.detect();
    expect(devinDetection.adapter.runtimeKind).toBe("hybrid");

    expect(registry.get("claude-code")).toBeUndefined();
    expect(registry.get("codex")).toBeUndefined();
  });
});
