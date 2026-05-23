import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  type FigmaReviewScope,
  type ReportArtifact,
  type ReviewChange,
  type ReviewSession,
  parseChangeTransitionInput,
  parseFigmaReviewScope,
  reviewChangeSchema
} from "@writer/contracts";
import {
  assertChangeTransition,
  assembleReviewContext,
  captureDesignContext,
  extractFigmaTextNodes,
  isWritebackEligible,
  parseFigmaUrl
} from "@writer/review-core";

import type { DaemonState } from "./state";
import { createSession } from "./state";

const pastedTextInputSchema = z.object({
  projectId: z.string().min(1),
  text: z.string().min(1)
});

const figmaUrlInputSchema = z.object({
  url: z.string().url()
});

const figmaExtractInputSchema = z.object({
  scope: z.record(z.string(), z.unknown())
});

const assembleContextInputSchema = z.object({
  sessionId: z.string().min(1),
  mode: z.enum(["clarity", "tone", "consistency", "accessibility", "full"]).optional(),
  brandVoice: z.string().optional(),
  glossary: z.array(z.string().min(1)).optional()
});

export function parseFigmaUrlInput(input: unknown) {
  const parsed = figmaUrlInputSchema.parse(input);
  return parseFigmaUrl(parsed.url);
}

export function extractFigmaNodes(input: unknown) {
  const parsed = figmaExtractInputSchema.parse(input);
  const scope = parseFigmaReviewScope(parsed.scope);
  const extraction = extractFigmaTextNodes(scope);
  const designContext = captureDesignContext(scope);

  return { extraction, designContext };
}

export async function createPastedTextSession(state: DaemonState, input: unknown): Promise<ReviewSession> {
  const parsed = pastedTextInputSchema.parse(input);

  return createSession(state, {
    projectId: parsed.projectId,
    sourceType: "pasted_text",
    scope: {
      text: parsed.text,
      itemCount: parsed.text.split(/\n+/).filter(Boolean).length
    }
  });
}

export function assembleSessionContext(state: DaemonState, input: unknown) {
  const parsed = assembleContextInputSchema.parse(input);
  const sessions = state.store.listSessions(null);
  const session = sessions.sessions.find((item) => item.id === parsed.sessionId);

  if (!session) {
    throw new Error("Session not found");
  }

  const scope = session.scope as Record<string, unknown>;
  const pastedText = session.sourceType === "pasted_text" ? String(scope.text ?? "") : undefined;
  const figmaScope =
    session.sourceType === "figma" ? parseFigmaReviewScope(scope) : undefined;
  const textNodes =
    figmaScope !== undefined
      ? extractFigmaTextNodes(figmaScope).nodes.map((node) => ({
          id: node.id,
          characters: node.characters,
          path: node.path
        }))
      : undefined;
  const designContext = figmaScope ? captureDesignContext(figmaScope) : undefined;

  return assembleReviewContext({
    sourceType: session.sourceType,
    mode: parsed.mode,
    scope,
    brandVoice: parsed.brandVoice,
    glossary: parsed.glossary,
    pastedText,
    textNodes,
    designContext
  });
}

export async function transitionReviewChange(state: DaemonState, input: unknown): Promise<ReviewChange> {
  const parsed = parseChangeTransitionInput(input);
  const existing = state.store.getReviewChange(parsed.changeId);

  if (!existing) {
    throw new Error("Review change not found");
  }

  assertChangeTransition(existing.status, parsed.nextStatus);

  const change = reviewChangeSchema.parse({
    ...existing,
    status: parsed.nextStatus,
    after: parsed.after ?? existing.after,
    updatedAt: new Date().toISOString(),
    updatedBy: parsed.actor
  });

  state.store.upsertReviewChange(change);
  state.store.appendAuditEntry({
    type: "permission_decision",
    timestamp: change.updatedAt,
    actor: parsed.actor,
    summary: `Change ${parsed.changeId} -> ${parsed.nextStatus}`,
    details: { changeId: change.id, sessionId: change.sessionId, status: change.status }
  });
  await state.store.save();

  return change;
}

export function listReviewChanges(state: DaemonState, sessionId: string | null) {
  return { changes: state.store.listReviewChanges(sessionId) };
}

export function requireApprovedChangeId(state: DaemonState, changeId: string | undefined, sessionId?: string): void {
  if (!changeId) {
    throw new Error("Missing approved change ID for write operation.");
  }

  const change = state.store.getReviewChange(changeId);

  if (!change) {
    throw new Error("Approved change ID not found.");
  }

  if (sessionId && change.sessionId !== sessionId) {
    throw new Error("Change ID does not belong to this session.");
  }

  if (!isWritebackEligible(change.status)) {
    throw new Error(`Change ${changeId} is not approved for writeback (status: ${change.status}).`);
  }
}

export function buildReportArtifact(state: DaemonState, sessionId: string): ReportArtifact {
  const sessions = state.store.listSessions(null);
  const session = sessions.sessions.find((item) => item.id === sessionId);

  if (!session) {
    throw new Error("Session not found");
  }

  const changes = state.store.listReviewChanges(sessionId);
  const applied = changes.filter((change) => change.status === "applied").length;
  const failed = changes.filter((change) => change.status === "failed").length;
  const skipped = changes.filter((change) => change.status === "skipped").length;

  return {
    id: `report-${randomUUID()}`,
    sessionId,
    projectId: session.projectId,
    sourceType: session.sourceType,
    scope: session.scope,
    generatedAt: new Date().toISOString(),
    findings: [],
    rewrites: [],
    changes,
    writebackSummary: { applied, failed, skipped }
  };
}

export async function seedDemoChange(state: DaemonState, sessionId: string): Promise<ReviewChange> {
  const change: ReviewChange = {
    id: `chg-${randomUUID()}`,
    sessionId,
    sourceId: "demo-node",
    status: "approved",
    before: "Continue",
    after: "Continue to checkout",
    rationale: "Clarify CTA action",
    updatedAt: new Date().toISOString(),
    updatedBy: "system"
  };

  state.store.upsertReviewChange(change);
  await state.store.save();
  return change;
}
