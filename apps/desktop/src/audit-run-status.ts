import type { ReviewSession } from "@writer/contracts";

export type AuditRunBadgeVariant = "in_progress" | "done" | "failed" | "partial" | "done_no_changes";

export type AuditRunBadge = {
  label: string;
  variant: AuditRunBadgeVariant;
};

export function deriveAuditRunBadge(session: ReviewSession): AuditRunBadge {
  if (session.status === "draft" || session.status === "running" || session.status === "reviewing") {
    return { label: "In Progress", variant: "in_progress" };
  }

  const report = session.writebackReport;

  if (report) {
    if (report.failed.length > 0 && report.written > 0) {
      return {
        label: `Partial · ${report.written} written, ${report.failed.length} failed`,
        variant: "partial"
      };
    }

    if (report.failed.length > 0) {
      return {
        label: `Failed · ${report.failed.length} failed`,
        variant: "failed"
      };
    }

    if (report.written === 0 && report.skipped > 0) {
      return { label: "Done · no changes", variant: "done_no_changes" };
    }

    if (report.written > 0) {
      return { label: `Done · ${report.written} written back`, variant: "done" };
    }
  }

  if (session.status === "completed") {
    return { label: "Done", variant: "done" };
  }

  return { label: session.status, variant: "failed" };
}

export function isFigmaAuditSession(session: ReviewSession): boolean {
  return session.sourceType === "figma" && Boolean(session.featureName);
}
