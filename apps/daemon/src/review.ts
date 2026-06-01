import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  type DesignContext,
  type FigmaReviewScope,
  type ReportArtifact,
  type ReviewChange,
  type ReviewSession,
  parseChangeTransitionInput,
  parseCreateFigmaSessionInput,
  parseFigmaReviewScope,
  reviewChangeSchema
} from "@writer/contracts";
import {
  assertChangeTransition,
  assembleReviewContext,
  captureDesignContext,
  extractFigmaTextNodesViaMcp,
  isWritebackEligible,
  parseFigmaUrl,
  normalizeReviewChangesSurface,
  toSurfaceCopy
} from "@writer/review-core";

import { createFigmaMcpCaller } from "./figma-mcp-caller";
import type { DaemonState } from "./state";
import { createSession } from "./state";

const pastedTextInputSchema = z.object({
  projectId: z.string().min(1),
  productId: z.string().min(1),
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

export async function extractFigmaNodes(state: DaemonState, input: unknown) {
  const parsed = figmaExtractInputSchema.parse(input);
  const scope = parseFigmaReviewScope(parsed.scope);
  const result = await extractFigmaTextNodesViaMcp(scope, createFigmaMcpCaller(state));

  if (!result.ok) {
    return {
      extraction: {
        scope: scope as unknown as Record<string, unknown>,
        nodes: [],
        extractedAt: new Date().toISOString()
      },
      diagnostic: result.diagnostic
    };
  }

  return {
    extraction: result.extraction,
    designContext: result.designContext
  };
}

export async function createPastedTextSession(state: DaemonState, input: unknown): Promise<ReviewSession> {
  const parsed = pastedTextInputSchema.parse(input);

  return createSession(state, {
    projectId: parsed.projectId,
    productId: parsed.productId,
    sourceType: "pasted_text",
    scope: {
      text: parsed.text,
      itemCount: parsed.text.split(/\n+/).filter(Boolean).length
    }
  });
}

export async function createFigmaReviewSession(state: DaemonState, input: unknown): Promise<ReviewSession> {
  const parsed = parseCreateFigmaSessionInput(input);

  const guidelineWorkflow = parsed.description.startsWith("Writing guidelines for")
    ? { workflow: "figma_guideline_generation" as const }
    : {};

  if (parsed.mode === "single_frame") {
    const figma = parseFigmaUrl(parsed.url);

    return createSession(state, {
      projectId: parsed.projectId,
      productId: parsed.productId,
      sourceType: "figma",
      featureName: parsed.featureName,
      description: parsed.description,
      mode: parsed.mode,
      scope: {
        url: parsed.url,
        fileKey: figma.fileKey,
        nodeId: figma.nodeId,
        suggestedScope: figma.suggestedScope,
        ...guidelineWorkflow
      }
    });
  }

  return createSession(state, {
    projectId: parsed.projectId,
    productId: parsed.productId,
    sourceType: "figma",
    featureName: parsed.featureName,
    description: parsed.description,
    mode: parsed.mode,
    scope: {
      fileKey: parsed.fileKey,
      suggestedScope: {
        kind: "flow",
        fileKey: parsed.fileKey,
        nodeIds: parsed.nodeIds,
        flowName: parsed.flowName,
        nodeNames: parsed.nodeNames
      },
      ...guidelineWorkflow
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
    session.sourceType === "figma" ? resolveFigmaScopeFromSession(scope) : undefined;
  const persistedExtraction = scope.extraction as { nodes?: Array<{ id: string; characters: string; path: string[] }> } | undefined;
  const persistedDesignContext = scope.designContext as DesignContext | undefined;
  const textNodes =
    persistedExtraction?.nodes?.map((node) => ({
      id: node.id,
      characters: node.characters,
      path: node.path
    })) ??
    (figmaScope
      ? []
      : undefined);
  const designContext =
    persistedDesignContext ??
    (figmaScope ? captureDesignContext(figmaScope) : undefined);

  return assembleReviewContext({
    sourceType: session.sourceType,
    mode: parsed.mode,
    scope,
    brandVoice: parsed.brandVoice,
    glossary: parsed.glossary,
    featureName: session.featureName,
    description: session.description,
    pastedText,
    textNodes,
    designContext,
    guidelineSnapshot: session.guidelineSnapshot
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
    before: toSurfaceCopy(existing.before),
    after: toSurfaceCopy(parsed.after ?? existing.after),
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
  return { changes: repairStoredReviewChanges(state, sessionId) };
}

export function repairStoredReviewChanges(state: DaemonState, sessionId: string | null): ReviewChange[] {
  const raw = state.store.listReviewChanges(sessionId);
  const normalized = normalizeReviewChangesSurface(raw);
  let dirty = false;

  for (let index = 0; index < raw.length; index += 1) {
    const before = raw[index];
    const after = normalized[index];

    if (!before || !after) {
      continue;
    }

    if (before.before !== after.before || before.after !== after.after) {
      state.store.upsertReviewChange(after);
      dirty = true;
    }
  }

  if (dirty) {
    void state.store.save();
  }

  return normalized;
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

function resolveFigmaScopeFromSession(scope: Record<string, unknown>): FigmaReviewScope {
  if (scope.suggestedScope) {
    return parseFigmaReviewScope(scope.suggestedScope);
  }

  return parseFigmaReviewScope(scope);
}

export function buildReportArtifact(state: DaemonState, sessionId: string): ReportArtifact {
  const sessions = state.store.listSessions(null);
  const session = sessions.sessions.find((item) => item.id === sessionId);

  if (!session) {
    throw new Error("Session not found");
  }

  const changes = state.store.listReviewChanges(sessionId);
  const findings = state.store.listFindings(sessionId);
  const rewrites = state.store.listRewrites(sessionId);
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
    findings,
    rewrites,
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
