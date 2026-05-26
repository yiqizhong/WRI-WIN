import { describe, expect, it } from "vitest";

import { getDaemonStatusView } from "./daemon-status";

describe("daemon status view model", () => {
  it("maps running health to a connected state", () => {
    const view = getDaemonStatusView({
      kind: "connected",
      health: {
        status: "running",
        version: "0.1.0",
        apiRevision: "4",
        capabilities: [{ id: "desktop-shell", status: "enabled" }]
      }
    });

    expect(view).toMatchObject({
      label: "Daemon connected",
      tone: "ready",
      detail: "Version 0.1.0 · 1 capability enabled"
    });
    expect(view.infoTooltip).toContain("127.0.0.1:47631");
  });

  it("maps unavailable daemon to a recovery message", () => {
    expect(getDaemonStatusView({ kind: "unavailable" })).toMatchObject({
      label: "Daemon unavailable",
      tone: "offline",
      detail: "Waiting for the local platform runtime. Quit and reopen the app, or run npm run dev:daemon."
    });
  });

  it("shows degraded capability messages in the detail line", () => {
    expect(
      getDaemonStatusView({
        kind: "degraded",
        health: {
          status: "degraded",
          version: "0.1.0",
          apiRevision: "4",
          capabilities: [
            { id: "desktop-shell", status: "enabled" },
            { id: "figma-mcp", status: "degraded", message: "Sign in required" }
          ]
        }
      })
    ).toMatchObject({
      label: "Daemon degraded",
      tone: "warning",
      detail: "Sign in required"
    });
  });
});
