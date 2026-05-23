import { describe, expect, it } from "vitest";

import { createDefaultMcpState } from "./mcp";
import { getDaemonCapabilities } from "./capabilities";
import type { DaemonState } from "./state";

function createState(figma: ReturnType<typeof createDefaultMcpState>["figma"]): DaemonState {
  return {
    store: {} as DaemonState["store"],
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: {
      ...createDefaultMcpState(),
      figma
    }
  };
}

describe("getDaemonCapabilities", () => {
  it("reports figma-mcp as disabled when the server is not enabled", () => {
    const capabilities = getDaemonCapabilities(createState(createDefaultMcpState().figma));
    const figma = capabilities.find((cap) => cap.id === "figma-mcp");

    expect(figma?.status).toBe("disabled");
  });

  it("reports figma-mcp as enabled when connected", () => {
    const figma = {
      ...createDefaultMcpState().figma,
      enabled: true,
      status: "connected" as const,
      diagnostic: undefined
    };
    const capabilities = getDaemonCapabilities(createState(figma));
    const figmaCapability = capabilities.find((cap) => cap.id === "figma-mcp");

    expect(figmaCapability?.status).toBe("enabled");
  });

  it("reports figma-mcp as degraded when enabled but not connected", () => {
    const figma = {
      ...createDefaultMcpState().figma,
      enabled: true,
      status: "error" as const,
      diagnostic: {
        code: "needs_auth" as const,
        severity: "warning" as const,
        message: "Sign in required"
      }
    };
    const capabilities = getDaemonCapabilities(createState(figma));
    const figmaCapability = capabilities.find((cap) => cap.id === "figma-mcp");

    expect(figmaCapability?.status).toBe("degraded");
    expect(figmaCapability?.message).toBe("Sign in required");
  });
});
