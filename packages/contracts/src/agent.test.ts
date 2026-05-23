import { describe, expect, it } from "vitest";

import { parseAgentAdapterList, parseAgentRun, parseAgentRunEvent } from "./agent";

const timestamp = "2026-05-22T12:00:00.000Z";

describe("agent contract", () => {
  it("accepts adapter capability metadata", () => {
    const list = parseAgentAdapterList({
      adapters: [
        {
          id: "codex",
          displayName: "Codex",
          available: true,
          executablePath: "/usr/local/bin/codex",
          runtimeKind: "hybrid",
          authState: "ready",
          diagnostic: {
            code: "ready",
            severity: "info",
            message: "Codex is ready."
          },
          capabilities: [{ id: "review", label: "UX copy review", enabled: true }]
        }
      ],
      activeAdapterId: "codex"
    });

    expect(list.adapters[0]?.available).toBe(true);
    expect(list.adapters[0]?.runtimeKind).toBe("hybrid");
    expect(list.adapters[0]?.diagnostic?.code).toBe("ready");
  });

  it("accepts normalized run events", () => {
    const event = parseAgentRunEvent({
      id: "evt-1",
      runId: "run-1",
      type: "text",
      timestamp,
      payload: { text: "Suggested shorter CTA." }
    });

    expect(event.type).toBe("text");
  });

  it("accepts agent run lifecycle metadata", () => {
    const run = parseAgentRun({
      id: "run-1",
      sessionId: "sess-1",
      adapterId: "codex",
      status: "running",
      prompt: "Review this button label.",
      startedAt: timestamp
    });

    expect(run.status).toBe("running");
  });

  it("rejects malformed run events", () => {
    expect(() =>
      parseAgentRunEvent({
        id: "evt-1",
        runId: "run-1",
        type: "stdout",
        timestamp,
        payload: {}
      })
    ).toThrow();
  });
});
