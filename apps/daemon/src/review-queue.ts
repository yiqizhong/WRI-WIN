import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  type ReportArtifact,
  type ReviewChange,
  type RewriteCandidate,
  type UxCopyFinding,
  type WritebackResult,
  reviewChangeSchema,
  updateProjectGuidanceInputSchema
} from "@writer/contracts";
import { isWritebackEligible, runStubAudit } from "@writer/review-core";
import { parseSpreadsheetFile } from "@writer/spreadsheet";

import type { DaemonState } from "./state";
import { buildReportArtifact, transitionReviewChange } from "./review";

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
  changeIds: z.array(z.string().min(1)).min(1)
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
  const items =
    session.sourceType === "pasted_text"
      ? String(scope.text ?? "")
          .split(/\n+/)
          .filter(Boolean)
          .map((text, index) => ({ sourceId: `line-${index + 1}`, text }))
      : session.sourceType === "spreadsheet" && Array.isArray(scope.rows)
        ? (scope.rows as Array<{ id: string; cells: Record<string, string> }>).map((row) => ({
            sourceId: row.id,
            text: Object.values(row.cells).join(" ")
          }))
        : [{ sourceId: "node-primary", text: "Continue" }, { sourceId: "node-secondary", text: "Click here" }];

  const project = state.store.listProjects().projects.find((item) => item.id === session.projectId);
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
      before: rewrite.before,
      after: rewrite.after,
      rationale: rewrite.rationale,
      updatedAt: new Date().toISOString(),
      updatedBy: "system"
    };
    state.store.upsertReviewChange(change);
  }

  state.store.appendAuditEntry({
    type: "agent_run_lifecycle",
    timestamp: new Date().toISOString(),
    actor: "system",
    summary: `Stub audit generated ${audit.findings.length} findings`,
    details: {
      sessionId: session.id,
      brandVoice: project?.brandVoice ?? null,
      findingCount: audit.findings.length
    }
  });
  await state.store.save();

  return {
    findings: audit.findings,
    rewrites: audit.rewrites,
    changes: state.store.listReviewChanges(session.id)
  };
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
    changes: state.store.listReviewChanges(sessionId)
  };
}

export async function runFigmaWriteback(state: DaemonState, input: unknown): Promise<WritebackResult> {
  const parsed = writebackSchema.parse(input);
  const results: WritebackResult["results"] = [];

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
        result: "applied"
      }
    });

    results.push({
      changeId,
      sourceId: change.sourceId,
      status: "applied",
      message: "Bootstrap writeback recorded (dry-run)."
    });
  }

  await state.store.save();

  return {
    sessionId: parsed.sessionId,
    results,
    completedAt: new Date().toISOString()
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
