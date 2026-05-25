import { describe, expect, it } from "vitest";

import { parseDaemonHealth } from "./daemon-health";

describe("daemon health contract", () => {
  it("accepts a running daemon health payload", () => {
    const health = parseDaemonHealth({
      status: "running",
      version: "0.1.0",
      apiRevision: "3",
      capabilities: [
        { id: "desktop-shell", status: "enabled" },
        { id: "figma-mcp", status: "degraded", message: "Not configured" }
      ]
    });

    expect(health.status).toBe("running");
    expect(health.capabilities[1]?.status).toBe("degraded");
  });

  it("rejects malformed daemon health payloads", () => {
    expect(() =>
      parseDaemonHealth({
        status: "online",
        version: "0.1.0",
        apiRevision: "3",
        capabilities: []
      })
    ).toThrow();
  });
});

