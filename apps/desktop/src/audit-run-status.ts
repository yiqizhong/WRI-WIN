import type { ReviewSession } from "@writer/contracts";

export type AuditRunStatusVariant = "in_progress" | "done" | "failed" | "pending";

export type AuditRunStatus = {
  label: "In Progress" | "Done" | "Fail" | "Not started";
  variant: AuditRunStatusVariant;
};

/** Muted pill classes for Audits Log (see writer-audits-log.css). */
export function auditRunStatusBadgeClassName(variant: AuditRunStatusVariant): string {
  const base = "writer-audit-status-badge";

  switch (variant) {
    case "done":
      return `${base} writer-audit-status-badge--neutral`;
    case "in_progress":
      return `${base} writer-audit-status-badge--in-progress`;
    case "failed":
      return `${base} writer-audit-status-badge--failed`;
    case "pending":
      return `${base} writer-audit-status-badge--neutral`;
  }
}

/** Audits Log created column — calendar date only (no time). */
export function formatAuditCreatedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric"
  });
}

export type WritebackDisplay = {
  label: string;
};

function hasAuditFailure(session: ReviewSession): boolean {
  if (session.diagnostic) {
    return true;
  }

  if (session.status === "canceled") {
    return true;
  }

  const scope = session.scope as Record<string, unknown> | undefined;
  return Boolean(scope?.extractionDiagnostic);
}

/** Audit run status for the Audits Log table (excludes writeback outcome). */
export function deriveAuditRunStatus(session: ReviewSession): AuditRunStatus {
  if (hasAuditFailure(session)) {
    return { label: "Fail", variant: "failed" };
  }

  if (session.status === "draft" || session.status === "running" || session.status === "reviewing") {
    return { label: "In Progress", variant: "in_progress" };
  }

  if (session.status === "completed") {
    return { label: "Done", variant: "done" };
  }

  return { label: "Fail", variant: "failed" };
}

function extractionTextNodeCount(session: ReviewSession): number {
  const scope = session.scope as Record<string, unknown> | undefined;
  const extraction = scope?.extraction as { nodes?: unknown[] } | undefined;

  return extraction?.nodes?.length ?? 0;
}

/** Whether Figma writeback was attempted and how it concluded. */
export function deriveWritebackDisplay(session: ReviewSession): WritebackDisplay {
  const report = session.writebackReport;

  if (!report) {
    if (hasAuditFailure(session)) {
      return { label: "—" };
    }

    if (session.status === "draft" || session.status === "running" || session.status === "reviewing") {
      return { label: "—" };
    }

    if (session.status === "completed") {
      if (session.sourceType === "figma" && extractionTextNodeCount(session) === 0) {
        return { label: "Nothing to update" };
      }

      return { label: "Pending Approval" };
    }

    return { label: "—" };
  }

  if (report.failed.length > 0 && report.written === 0) {
    return { label: "Failed" };
  }

  if (report.failed.length > 0 && report.written > 0) {
    return { label: "Partial" };
  }

  if (report.written > 0) {
    return { label: "Written back" };
  }

  if (report.skipped > 0) {
    return { label: "Nothing to update" };
  }

  return { label: "—" };
}

/** Audit detail is read-only once writeback finished with nothing left to approve. */
export function isAuditWritebackFinalized(session: ReviewSession): boolean {
  const label = deriveWritebackDisplay(session).label;

  return label === "Written back" || label === "Nothing to update";
}

export function isFigmaAuditSession(session: ReviewSession): boolean {
  const scope = session.scope as Record<string, unknown> | undefined;
  if (scope?.workflow === "figma_guideline_generation") {
    return false;
  }

  if (session.description?.startsWith("Writing guidelines for")) {
    return false;
  }

  return session.sourceType === "figma" && Boolean(session.featureName);
}
