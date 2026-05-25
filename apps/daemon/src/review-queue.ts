import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  type ReportArtifact,
  type ReviewChange,
  type RewriteCandidate,
  type SessionWritebackReport,
  type UxCopyFinding,
  type WritebackResult,
  reviewChangeSchema,
  updateProjectGuidanceInputSchema
} from "@writer/contracts";
import {
  type ConnectionDiagnostic,
  parseFigmaReviewScope
} from "@writer/contracts";
import {
  extractFigmaTextNodesViaMcp,
  isExtractableFigmaText,
  isWritebackEligible,
  runStubAudit,
  toExtractedCopy,
  toSurfaceCopy,
  writeFigmaTextNodeViaMcp
} from "@writer/review-core";
import { parseSpreadsheetFile } from "@writer/spreadsheet";

import { getCachedTree } from "./guidelines/cache";
import { discoverGuidelines } from "./guidelines/discovery";
import { buildResolvedTree } from "./guidelines/inheritance";
import { buildThreeLayerSnapshot } from "./guidelines/snapshot";
import { captureSessionFrameScreenshots } from "./figma-screenshots";
import { createFigmaMcpCaller } from "./figma-mcp-caller";
import { assertFigmaWritePermission } from "./figma-write-permission";
import {
  figmaExtractionCacheKey,
  getCachedFigmaExtraction,
  setCachedFigmaExtraction
} from "./figma-extraction-cache";
import type { DaemonState } from "./state";
import { buildReportArtifact, repairStoredReviewChanges, transitionReviewChange } from "./review";

const bulkTransitionSchema = z.object({
  changeIds: z.array(z.string().min(1)).min(1),
  nextStatus: z.enum(["approved", "rejected", "skipped"]),
  actor: z.enum(["system", "user", "agent"]).default("user")
});

const runAuditSchema = z.object({
  sessionId: z.string().min(1)
});

const writebackSchema = z.object({
  sessionId: z.string().min(1),
  changeIds: z.array(z.string().min(1)).min(1),
  permissionRequestId: z.string().min(1).optional()
});

const spreadsheetParseSchema = z.object({
  filePath: z.string().min(1)
});

export async function updateProjectGuidance(state: DaemonState, input: unknown) {
  const parsed = updateProjectGuidanceInputSchema.parse(input);
  const projects = state.store.listProjects();
  const project = projects.projects.find((item) => item.id === parsed.projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const updated = state.store.upsertProject({
    ...project,
    brandVoice: parsed.brandVoice ?? project.brandVoice,
    glossary: parsed.glossary ?? project.glossary,
    updatedAt: new Date().toISOString()
  });

  await state.store.save();
  return updated;
}

export async function runSessionAudit(state: DaemonState, input: unknown) {
  const parsed = runAuditSchema.parse(input);
  const sessions = state.store.listSessions(null);
  const session = sessions.sessions.find((item) => item.id === parsed.sessionId);

  if (!session) {
    throw new Error("Session not found");
  }

  const scope = session.scope as Record<string, unknown>;
  let diagnostic: ConnectionDiagnostic | undefined;
  let updatedScope = scope;

  if (session.sourceType === "figma") {
    const figmaScope = resolveFigmaScope(scope);
    const extractionResult = await extractFigmaForAudit(state, figmaScope);

    if (!extractionResult.ok) {
      diagnostic = extractionResult.diagnostic;
      updatedScope = {
        ...scope,
        extraction: { nodes: [], extractedAt: new Date().toISOString(), scope },
        extractionDiagnostic: diagnostic,
        designContext: undefined
      };
      state.store.upsertSession({
        ...session,
        scope: updatedScope,
        updatedAt: new Date().toISOString()
      });
      await state.store.save();

      return {
        findings: [],
        rewrites: [],
        changes: [],
        diagnostic
      };
    }

    updatedScope = {
      ...scope,
      extraction: extractionResult.extraction,
      designContext: extractionResult.designContext,
      extractionDiagnostic: undefined
    };
    state.store.upsertSession({
      ...session,
      scope: updatedScope,
      updatedAt: new Date().toISOString()
    });
  }

  const items = buildAuditItems(session.sourceType, updatedScope);

  const project = state.store.listProjects().projects.find((item) => item.id === session.projectId);
  const productId = session.productId ?? project?.activeProductId ?? null;
  const guidelineTree = getCachedTree() ?? (await discoverGuidelines());
  const resolvedTree = buildResolvedTree(guidelineTree);
  const guidelineSnapshot = buildThreeLayerSnapshot(resolvedTree, productId);

  const audit = runStubAudit({
    sessionId: session.id,
    sourceType: session.sourceType,
    items
  });

  for (const finding of audit.findings) {
    state.store.upsertFinding(finding);
  }

  for (const rewrite of audit.rewrites) {
    state.store.upsertRewrite(rewrite);

    const change: ReviewChange = {
      id: `chg-${randomUUID()}`,
      sessionId: session.id,
      sourceId: rewrite.sourceId,
      status: "proposed",
      before: toSurfaceCopy(rewrite.before),
      after: toSurfaceCopy(rewrite.after),
      rationale: rewrite.rationale,
      updatedAt: new Date().toISOString(),
      updatedBy: "system"
    };
    state.store.upsertReviewChange(change);
  }

  if (session.sourceType === "figma" && !diagnostic) {
    seedReviewChangesFromExtraction(state, session.id, updatedScope);
  }

  const timestamp = new Date().toISOString();
  let frameScreenshots = session.frameScreenshots;

  if (session.sourceType === "figma" && !diagnostic) {
    frameScreenshots = await captureSessionFrameScreenshots(state, {
      ...session,
      scope: updatedScope
    });
  }

  state.store.upsertSession({
    ...session,
    scope: updatedScope,
    guidelineSnapshot,
    frameScreenshots,
    status: diagnostic ? session.status : "completed",
    updatedAt: timestamp
  });

  state.store.appendAuditEntry({
    type: "agent_run_lifecycle",
    timestamp: new Date().toISOString(),
    actor: "system",
    summary: `Stub audit generated ${audit.findings.length} findings`,
    details: {
      sessionId: session.id,
      productId,
      brandVoice: project?.brandVoice ?? null,
      findingCount: audit.findings.length
    }
  });
  await state.store.save();

  return {
    findings: audit.findings,
    rewrites: audit.rewrites,
    changes: state.store.listReviewChanges(session.id),
    diagnostic
  };
}

function resolveFigmaScope(scope: Record<string, unknown>) {
  if (scope.suggestedScope) {
    return parseFigmaReviewScope(scope.suggestedScope);
  }

  return parseFigmaReviewScope(scope);
}

async function extractFigmaForAudit(
  state: DaemonState,
  figmaScope: ReturnType<typeof parseFigmaReviewScope>
) {
  const nodeId =
    figmaScope.kind === "frame"
      ? figmaScope.nodeId
      : figmaScope.kind === "flow"
        ? figmaScope.nodeIds.join(",")
        : undefined;
  const cacheKey = figmaExtractionCacheKey(figmaScope.fileKey, nodeId);
  const cached = getCachedFigmaExtraction(cacheKey);

  if (cached) {
    return cached;
  }

  const extraction = await extractFigmaTextNodesViaMcp(figmaScope, createFigmaMcpCaller(state));

  if (extraction.ok) {
    setCachedFigmaExtraction(cacheKey, extraction);
  }

  return extraction;
}

function seedReviewChangesFromExtraction(
  state: DaemonState,
  sessionId: string,
  scope: Record<string, unknown>
): void {
  const extraction = scope.extraction as
    | { nodes?: Array<{ id: string; name?: string; characters: string }> }
    | undefined;
  const nodes = extraction?.nodes ?? [];
  const existing = state.store.listReviewChanges(sessionId);
  const covered = new Set(existing.map((change) => change.sourceId));
  const timestamp = new Date().toISOString();

  for (const node of nodes) {
    if (covered.has(node.id)) {
      continue;
    }

    const extracted = toExtractedCopy(node.characters);
    const before =
      extracted.length > 0 && isExtractableFigmaText(extracted)
        ? extracted
        : toExtractedCopy(node.name ?? "") || "(empty text layer)";

    state.store.upsertReviewChange({
      id: `chg-${randomUUID()}`,
      sessionId,
      sourceId: node.id,
      status: "proposed",
      before,
      after: before,
      rationale: "Extracted from Figma TEXT layer. No automated rewrite suggested.",
      updatedAt: timestamp,
      updatedBy: "system"
    });
    covered.add(node.id);
  }
}

function buildAuditItems(
  sourceType: "figma" | "pasted_text" | "spreadsheet",
  scope: Record<string, unknown>
): Array<{ sourceId: string; text: string }> {
  if (sourceType === "pasted_text") {
    return String(scope.text ?? "")
      .split(/\n+/)
      .filter(Boolean)
      .map((text, index) => ({ sourceId: `line-${index + 1}`, text }));
  }

  if (sourceType === "spreadsheet" && Array.isArray(scope.rows)) {
    return (scope.rows as Array<{ id: string; cells: Record<string, string> }>).map((row) => ({
      sourceId: row.id,
      text: Object.values(row.cells).join(" ")
    }));
  }

  if (sourceType === "figma") {
    const extraction = scope.extraction as { nodes?: Array<{ id: string; characters: string }> } | undefined;
    const nodes = extraction?.nodes ?? [];

    return nodes.map((node) => ({
      sourceId: node.id,
      text: toSurfaceCopy(node.characters)
    }));
  }

  return [];
}

export async function bulkTransitionChanges(state: DaemonState, input: unknown) {
  const parsed = bulkTransitionSchema.parse(input);
  const results: ReviewChange[] = [];

  for (const changeId of parsed.changeIds) {
    const change = await transitionReviewChange(state, {
      changeId,
      nextStatus: parsed.nextStatus,
      actor: parsed.actor
    });
    results.push(change);
  }

  return { changes: results };
}

export function listReviewQueue(state: DaemonState, sessionId: string) {
  return {
    findings: state.store.listFindings(sessionId),
    rewrites: state.store.listRewrites(sessionId),
    changes: repairStoredReviewChanges(state, sessionId)
  };
}

export async function runFigmaWriteback(state: DaemonState, input: unknown): Promise<WritebackResult> {
  const parsed = writebackSchema.parse(input);
  const results: WritebackResult["results"] = [];
  let permissionRequestId: string | undefined;
  let written = 0;
  let skipped = 0;
  const writebackFailures: SessionWritebackReport["failed"] = [];

  const sessions = state.store.listSessions(null);
  const session = sessions.sessions.find((item) => item.id === parsed.sessionId);

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.sourceType !== "figma") {
    throw new Error("Figma writeback requires a Figma review session.");
  }

  const scope = session.scope as Record<string, unknown>;
  const figmaScope = resolveFigmaScope(scope);
  const fileKey = figmaScope.fileKey;
  const mcpCaller = createFigmaMcpCaller(state);

  for (const changeId of parsed.changeIds) {
    const change = state.store.getReviewChange(changeId);

    if (!change || change.sessionId !== parsed.sessionId) {
      results.push({
        changeId,
        sourceId: change?.sourceId ?? "unknown",
        status: "failed",
        message: "Change not found for session"
      });
      continue;
    }

    if (!isWritebackEligible(change.status) && change.status !== "queued_for_writeback") {
      results.push({
        changeId,
        sourceId: change.sourceId,
        status: "skipped",
        message: `Change not eligible (status: ${change.status})`
      });
      skipped += 1;
      continue;
    }

    if (toSurfaceCopy(change.after) === toSurfaceCopy(change.before)) {
      results.push({
        changeId,
        sourceId: change.sourceId,
        status: "skipped",
        message: "No text change from original Figma copy"
      });
      skipped += 1;
      continue;
    }

    const permission = await assertFigmaWritePermission(state, {
      sessionId: parsed.sessionId,
      changeId,
      permissionRequestId: parsed.permissionRequestId
    });

    if (!permission.ok) {
      permissionRequestId ??= permission.permissionRequestId;
      results.push({
        changeId,
        sourceId: change.sourceId,
        status: "failed",
        message: permission.message
      });
      writebackFailures.push({
        nodeId: change.sourceId,
        errorCode: "permission_denied",
        errorMessage: permission.message
      });

      state.store.appendAuditEntry({
        type: "permission_decision",
        timestamp: new Date().toISOString(),
        actor: "system",
        summary: `Figma writeback blocked for ${change.sourceId}`,
        details: {
          changeId,
          sessionId: parsed.sessionId,
          permissionRequestId: permission.permissionRequestId,
          reason: permission.message
        }
      });
      continue;
    }

    const writeResult = await writeFigmaTextNodeViaMcp(
      fileKey,
      change.sourceId,
      change.after,
      mcpCaller
    );

    if (!writeResult.ok) {
      const failedChange = reviewChangeSchema.parse({
        ...change,
        status: "failed",
        updatedAt: new Date().toISOString(),
        updatedBy: "system"
      });
      state.store.upsertReviewChange(failedChange);

      state.store.appendAuditEntry({
        type: "tool_attempt",
        timestamp: failedChange.updatedAt,
        actor: "system",
        summary: `Figma writeback failed for ${change.sourceId}`,
        details: {
          changeId,
          sessionId: parsed.sessionId,
          diagnostic: writeResult.diagnostic,
          before: change.before,
          after: change.after,
          result: "failed"
        }
      });

      results.push({
        changeId,
        sourceId: change.sourceId,
        status: "failed",
        message: writeResult.diagnostic.message
      });
      writebackFailures.push({
        nodeId: change.sourceId,
        errorCode: writeResult.diagnostic.code,
        errorMessage: writeResult.diagnostic.message
      });
      continue;
    }

    const applied = reviewChangeSchema.parse({
      ...change,
      status: "applied",
      updatedAt: new Date().toISOString(),
      updatedBy: "system"
    });
    state.store.upsertReviewChange(applied);

    state.store.appendAuditEntry({
      type: "tool_attempt",
      timestamp: applied.updatedAt,
      actor: "system",
      summary: `Figma writeback applied for ${change.sourceId}`,
      details: {
        changeId,
        sessionId: parsed.sessionId,
        before: change.before,
        after: change.after,
        mutatedNodeIds: writeResult.mutatedNodeIds,
        result: "applied"
      }
    });

    results.push({
      changeId,
      sourceId: change.sourceId,
      status: "applied",
      message: `Updated Figma node ${change.sourceId}.`
    });
    written += 1;
  }

  const writebackReport: SessionWritebackReport = {
    attemptedAt: new Date().toISOString(),
    written,
    skipped,
    failed: writebackFailures
  };

  state.store.upsertSession({
    ...session,
    writebackReport,
    updatedAt: writebackReport.attemptedAt
  });

  await state.store.save();

  return {
    sessionId: parsed.sessionId,
    results,
    completedAt: writebackReport.attemptedAt,
    permissionRequestId
  };
}

export async function parseSpreadsheet(state: DaemonState, input: unknown) {
  const parsed = spreadsheetParseSchema.parse(input);
  return parseSpreadsheetFile(parsed.filePath);
}

export function getSessionChangelog(state: DaemonState, sessionId: string) {
  const entries = state.store.listAuditLog().entries.filter(
    (entry) => entry.details && (entry.details as { sessionId?: string }).sessionId === sessionId
  );

  return { entries };
}

export function exportReportMarkdown(artifact: ReportArtifact): string {
  const lines = [
    `# Review report`,
    ``,
    `- Session: ${artifact.sessionId}`,
    `- Source: ${artifact.sourceType}`,
    `- Generated: ${artifact.generatedAt}`,
    ``,
    `## Changes`,
    ...artifact.changes.map(
      (change) =>
        `- **${change.status}** ${change.sourceId}: "${change.before}" → "${change.after}"`
    )
  ];

  return lines.join("\n");
}

export function exportReportJson(artifact: ReportArtifact): string {
  return JSON.stringify(artifact, null, 2);
}
