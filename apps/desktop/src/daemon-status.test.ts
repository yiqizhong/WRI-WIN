import { describe, expect, it } from "vitest";

import { getDaemonStatusView } from "./daemon-status";

describe("daemon status view model", () => {
  it("maps running health to a connected state", () => {
    expect(
      getDaemonStatusView({
        kind: "connected",
        health: {
          status: "running",
          version: "0.1.0",
          capabilities: [{ id: "desktop-shell", status: "enabled" }]
        }
      })
    ).toEqual({
      label: "Daemon connected",
      tone: "ready",
      detail: "Version 0.1.0 · 1 capability enabled"
    });
  });

  it("maps unavailable daemon to a recovery message", () => {
    expect(getDaemonStatusView({ kind: "unavailable" })).toEqual({
      label: "Daemon unavailable",
      tone: "offline",
      detail: "Start the local daemon to enable agents, MCP, files, and writeback."
    });
  });
});
