import { describe, expect, it } from "vitest";

import type { ReviewSession } from "@writer/contracts";

import { deriveAuditRunBadge } from "./audit-run-status";

function session(partial: Partial<ReviewSession>): ReviewSession {
  return {
    id: "sess-1",
    projectId: "proj-1",
    sourceType: "figma",
    scope: {},
    status: "reviewing",
    agentRunIds: [],
    createdAt: "2026-05-25T12:00:00.000Z",
    updatedAt: "2026-05-25T12:00:00.000Z",
    ...partial
  };
}

describe("deriveAuditRunBadge", () => {
  it("marks reviewing sessions as in progress", () => {
    expect(deriveAuditRunBadge(session({ status: "reviewing" })).variant).toBe("in_progress");
  });

  it("marks partial writeback", () => {
    const badge = deriveAuditRunBadge(
      session({
        status: "completed",
        writebackReport: {
          attemptedAt: "2026-05-25T12:00:00.000Z",
          written: 2,
          skipped: 0,
          failed: [{ nodeId: "1:11", errorCode: "write_failed", errorMessage: "Denied" }]
        }
      })
    );
    expect(badge.variant).toBe("partial");
  });

  it("marks no-op writeback", () => {
    const badge = deriveAuditRunBadge(
      session({
        status: "completed",
        writebackReport: {
          attemptedAt: "2026-05-25T12:00:00.000Z",
          written: 0,
          skipped: 3,
          failed: []
        }
      })
    );
    expect(badge.variant).toBe("done_no_changes");
  });
});
