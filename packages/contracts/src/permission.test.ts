import { describe, expect, it } from "vitest";

import {
  parsePermissionDecisionInput,
  parsePermissionRequest,
  parsePermissionRequestList
} from "./permission";

const timestamp = "2026-05-22T12:00:00.000Z";

describe("permission contract", () => {
  it("accepts pending permission requests", () => {
    const request = parsePermissionRequest({
      id: "perm-1",
      toolId: "figma.write",
      toolName: "Write Figma text",
      risk: "write",
      sessionId: "sess-1",
      runId: "run-1",
      reason: "Agent requested Figma writeback.",
      decision: "pending"
    });

    expect(request.decision).toBe("pending");
  });

  it("accepts permission request lists and decision input", () => {
    const list = parsePermissionRequestList({
      requests: [
        {
          id: "perm-1",
          toolId: "figma.write",
          toolName: "Write Figma text",
          risk: "destructive",
          reason: "Smoke test write.",
          decision: "approved",
          decidedAt: timestamp,
          decidedBy: "user"
        }
      ]
    });

    const input = parsePermissionDecisionInput({
      requestId: "perm-1",
      decision: "denied"
    });

    expect(list.requests[0]?.decision).toBe("approved");
    expect(input.decision).toBe("denied");
  });

  it("rejects invalid permission decisions", () => {
    expect(() =>
      parsePermissionRequest({
        id: "perm-1",
        toolId: "figma.write",
        toolName: "Write Figma text",
        risk: "write",
        reason: "Test",
        decision: "maybe"
      })
    ).toThrow();
  });
});
