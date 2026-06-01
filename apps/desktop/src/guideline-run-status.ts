import type { ReviewSession } from "@writer/contracts";

import type { AuditRunStatus } from "./audit-run-status";
import { auditRunStatusBadgeClassName, formatAuditCreatedDate } from "./audit-run-status";

export type GuidelineGenerationScopeRecord = {
  ok?: boolean;
  completedAt?: string;
  startedAt?: string;
  inFlight?: boolean;
  progressStage?: string;
  progressMessage?: string;
  progressBatchIndex?: number;
  progressBatchTotal?: number;
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
  if (parsed.inFlight === true) {
    return parsed;
  }

  if (typeof parsed.ok === "boolean" && typeof parsed.completedAt === "string") {
    return parsed;
  }

  return undefined;
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

  if (generation?.inFlight === true) {
    return { label: "In Progress", variant: "in_progress" };
  }

  if (generation?.ok === true) {
    return { label: "Done", variant: "done" };
  }

  if (generation?.ok === false) {
    return { label: "Fail", variant: "failed" };
  }

  if (session.diagnostic) {
    return { label: "Fail", variant: "failed" };
  }

  if (session.status === "draft") {
    return { label: "Not started", variant: "pending" };
  }

  if (session.status === "running" || session.status === "reviewing") {
    return { label: "In Progress", variant: "in_progress" };
  }

  if (session.status === "completed") {
    return { label: "Done", variant: "done" };
  }

  return { label: "Fail", variant: "failed" };
}

/** Product name from the generator form (stored on session.featureName). */
export function formatGuidelineProductName(session: ReviewSession): string {
  const fromFeature = session.featureName?.trim();
  if (fromFeature) {
    return fromFeature;
  }

  const description = session.description?.trim();
  if (description?.startsWith("Writing guidelines for ")) {
    const parsed = description.slice("Writing guidelines for ".length).replace(/\.$/, "").trim();
    if (parsed) {
      return parsed;
    }
  }

  return "—";
}

export function hasInProgressGuideline(sessions: ReviewSession[]): boolean {
  return sessions.some((entry) => deriveGuidelineRunStatus(entry).variant === "in_progress");
}

export { auditRunStatusBadgeClassName, formatAuditCreatedDate };
