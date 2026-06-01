import type { ReviewSession } from "@writer/contracts";

import type { AuditRunStatus } from "./audit-run-status";
import { auditRunStatusBadgeClassName, formatAuditCreatedDate } from "./audit-run-status";

export type GuidelineGenerationScopeRecord = {
  ok: boolean;
  completedAt: string;
  fileNames?: string[];
  files?: Array<{ name: string; mimeType: string; content: string }>;
};

export function readGuidelineGenerationScope(
  session: ReviewSession
): GuidelineGenerationScopeRecord | undefined {
  const scope = session.scope as Record<string, unknown> | undefined;
  const record = scope?.guidelineGeneration;
  if (!record || typeof record !== "object") {
    return undefined;
  }

  const parsed = record as GuidelineGenerationScopeRecord;
  if (typeof parsed.ok !== "boolean" || typeof parsed.completedAt !== "string") {
    return undefined;
  }

  return parsed;
}

export function isFigmaGuidelineSession(session: ReviewSession): boolean {
  const scope = session.scope as Record<string, unknown> | undefined;
  if (scope?.workflow === "figma_guideline_generation") {
    return true;
  }

  return Boolean(session.description?.startsWith("Writing guidelines for"));
}

export function sortFigmaGuidelineSessions(sessions: ReviewSession[]): ReviewSession[] {
  return sessions
    .filter(isFigmaGuidelineSession)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function deriveGuidelineRunStatus(session: ReviewSession): AuditRunStatus {
  const generation = readGuidelineGenerationScope(session);

  if (generation?.ok === true) {
    return { label: "Done", variant: "done" };
  }

  if (generation?.ok === false || session.diagnostic) {
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

export function formatGuidelineFilesDisplay(session: ReviewSession): string {
  const generation = readGuidelineGenerationScope(session);
  if (!generation) {
    return "—";
  }

  if (!generation.ok) {
    return "—";
  }

  const count = generation.fileNames?.length ?? generation.files?.length ?? 0;
  if (count === 0) {
    return "—";
  }

  return count === 1 ? "1 file" : `${count} files`;
}

export function hasInProgressGuideline(sessions: ReviewSession[]): boolean {
  return sessions.some((entry) => deriveGuidelineRunStatus(entry).variant === "in_progress");
}

export { auditRunStatusBadgeClassName, formatAuditCreatedDate };
