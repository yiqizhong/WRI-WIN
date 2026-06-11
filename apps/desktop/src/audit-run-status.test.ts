import { describe, expect, it } from "vitest";

import type { ReviewSession } from "@writer/contracts";

import {
  auditRunStatusBadgeClassName,
  deriveAuditRunStatus,
  deriveWritebackDisplay,
  formatAuditCreatedDate,
  isAuditWritebackFinalized
} from "./audit-run-status";

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

describe("deriveAuditRunStatus", () => {
  it("marks active sessions as in progress", () => {
    expect(deriveAuditRunStatus(session({ status: "reviewing" }))).toEqual({
      label: "In Progress",
      variant: "in_progress"
    });
  });

  it("marks completed sessions as done", () => {
    expect(deriveAuditRunStatus(session({ status: "completed" }))).toEqual({
      label: "Done",
      variant: "done"
    });
  });

  it("marks extraction failures as fail even while status is still reviewing", () => {
    expect(
      deriveAuditRunStatus(
        session({
          status: "reviewing",
          scope: {
            extractionDiagnostic: { code: "mcp_unavailable", message: "Figma MCP not connected" }
          }
        })
      )
    ).toEqual({
      label: "Fail",
      variant: "failed"
    });
  });
});

describe("auditRunStatusBadgeClassName", () => {
  it("maps audit status variants to muted pill classes", () => {
    expect(auditRunStatusBadgeClassName("done")).toContain("writer-audit-status-badge--neutral");
    expect(auditRunStatusBadgeClassName("in_progress")).toContain("writer-audit-status-badge--in-progress");
    expect(auditRunStatusBadgeClassName("failed")).toContain("writer-audit-status-badge--failed");
  });
});

describe("formatAuditCreatedDate", () => {
  it("formats ISO timestamps as a date without time", () => {
    const formatted = formatAuditCreatedDate("2026-05-27T20:10:17.000Z");
    expect(formatted).not.toMatch(/:/);
    expect(formatted).toMatch(/2026/);
  });
});

describe("deriveWritebackDisplay", () => {
  it("shows em dash while audit is in progress", () => {
    expect(deriveWritebackDisplay(session({ status: "reviewing" })).label).toBe("—");
  });

  it("shows pending approval when audit finished and writeback not run", () => {
    expect(
      deriveWritebackDisplay(
        session({
          status: "completed",
          scope: {
            extraction: { nodes: [{ id: "1:1" }] }
          }
        })
      ).label
    ).toBe("Pending Approval");
  });

  it("shows nothing to update when audit extracted no text layers", () => {
    expect(
      deriveWritebackDisplay(
        session({
          status: "completed",
          scope: { extraction: { nodes: [] } }
        })
      ).label
    ).toBe("Nothing to update");
  });

  it("shows nothing to update when writeback skipped all rows", () => {
    expect(
      deriveWritebackDisplay(
        session({
          status: "completed",
          writebackReport: {
            attemptedAt: "2026-05-25T12:00:00.000Z",
            written: 0,
            skipped: 3,
            failed: []
          }
        })
      ).label
    ).toBe("Nothing to update");
  });

  it("marks partial writeback", () => {
    expect(
      deriveWritebackDisplay(
        session({
          status: "completed",
          writebackReport: {
            attemptedAt: "2026-05-25T12:00:00.000Z",
            written: 2,
            skipped: 0,
            failed: [{ nodeId: "1:11", errorCode: "write_failed", errorMessage: "Denied" }]
          }
        })
      ).label
    ).toBe("Partial");
  });

  it("marks successful writeback", () => {
    expect(
      deriveWritebackDisplay(
        session({
          status: "completed",
          writebackReport: {
            attemptedAt: "2026-05-25T12:00:00.000Z",
            written: 2,
            skipped: 0,
            failed: []
          }
        })
      ).label
    ).toBe("Written back");
  });
});

describe("isAuditWritebackFinalized", () => {
  it("locks the audit detail after a successful writeback", () => {
    expect(
      isAuditWritebackFinalized(
        session({
          status: "completed",
          writebackReport: {
            attemptedAt: "2026-05-25T12:00:00.000Z",
            written: 2,
            skipped: 0,
            failed: []
          }
        })
      )
    ).toBe(true);
  });

  it("locks the audit detail when writeback skipped every row", () => {
    expect(
      isAuditWritebackFinalized(
        session({
          status: "completed",
          writebackReport: {
            attemptedAt: "2026-05-25T12:00:00.000Z",
            written: 0,
            skipped: 3,
            failed: []
          }
        })
      )
    ).toBe(true);
  });

  it("keeps the audit detail editable while approval is pending", () => {
    expect(
      isAuditWritebackFinalized(
        session({
          status: "completed",
          scope: {
            extraction: { nodes: [{ id: "1:1" }] }
          }
        })
      )
    ).toBe(false);
  });

  it("keeps the audit detail editable after a partial writeback", () => {
    expect(
      isAuditWritebackFinalized(
        session({
          status: "completed",
          writebackReport: {
            attemptedAt: "2026-05-25T12:00:00.000Z",
            written: 1,
            skipped: 0,
            failed: [{ nodeId: "1:11", errorCode: "write_failed", errorMessage: "Denied" }]
          }
        })
      )
    ).toBe(false);
  });
});
