import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { randomUUID } from "node:crypto";

import {
  type AgentRun,
  type AgentRunEvent,
  type AuditLogEntry,
  type AuditLogList,
  type Project,
  type ProjectList,
  type ReviewChange,
  type ReviewSession,
  type ReviewSessionList,
  type RewriteCandidate,
  type UxCopyFinding,
  type PasteTextConversation,
  agentRunEventSchema,
  agentRunSchema,
  auditLogListSchema,
  auditLogEntrySchema,
  projectListSchema,
  projectSchema,
  reviewChangeSchema,
  reviewSessionListSchema,
  reviewSessionSchema,
  rewriteCandidateSchema,
  uxCopyFindingSchema,
  pasteTextConversationSchema
} from "@writer/contracts";

export const STORAGE_VERSION = 1;

export type PlatformStoreSnapshot = {
  version: number;
  projects: Project[];
  activeProjectId: string | null;
  sessions: ReviewSession[];
  auditLog: AuditLogEntry[];
  agentRuns: AgentRun[];
  agentRunEvents: AgentRunEvent[];
  activeAdapterId: string | null;
  reviewChanges: ReviewChange[];
  findings: UxCopyFinding[];
  rewrites: RewriteCandidate[];
  pasteTextConversations: PasteTextConversation[];
};

export type PlatformStoreOptions = {
  dataDir?: string;
};

export function getDefaultDataDir() {
  return join(homedir(), ".writer");
}

export class PlatformStore {
  readonly dataDir: string;
  readonly filePath: string;

  private snapshot: PlatformStoreSnapshot;
  private saveChain: Promise<void> = Promise.resolve();

  constructor(options: PlatformStoreOptions = {}) {
    this.dataDir = options.dataDir ?? getDefaultDataDir();
    this.filePath = join(this.dataDir, "platform-store.json");
    this.snapshot = {
      version: STORAGE_VERSION,
      projects: [],
      activeProjectId: null,
      sessions: [],
      auditLog: [],
      agentRuns: [],
      agentRunEvents: [],
      activeAdapterId: null,
      reviewChanges: [],
      findings: [],
      rewrites: [],
      pasteTextConversations: []
    };
  }

  async load(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });

    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PlatformStoreSnapshot;

      this.snapshot = {
        version: parsed.version ?? STORAGE_VERSION,
        projects: projectListSchema.parse({
          projects: parsed.projects ?? [],
          activeProjectId: parsed.activeProjectId ?? null
        }).projects,
        activeProjectId: parsed.activeProjectId ?? null,
        sessions: reviewSessionListSchema.parse({
          sessions: parsed.sessions ?? []
        }).sessions,
        auditLog: auditLogListSchema.parse({
          entries: parsed.auditLog ?? []
        }).entries,
        agentRuns: (parsed.agentRuns ?? []).map((run) => agentRunSchema.parse(run)),
        agentRunEvents: (parsed.agentRunEvents ?? []).map((event) => agentRunEventSchema.parse(event)),
        activeAdapterId:
          parsed.activeAdapterId === "byok" ? null : (parsed.activeAdapterId ?? null),
        reviewChanges: (parsed.reviewChanges ?? []).map((change) => reviewChangeSchema.parse(change)),
        findings: (parsed.findings ?? []).map((finding) => uxCopyFindingSchema.parse(finding)),
        rewrites: (parsed.rewrites ?? []).map((rewrite) => rewriteCandidateSchema.parse(rewrite)),
        pasteTextConversations: (parsed.pasteTextConversations ?? []).map((conversation) =>
          pasteTextConversationSchema.parse(conversation)
        )
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await this.save();
        return;
      }

      throw error;
    }
  }

  async save(): Promise<void> {
    const next = this.saveChain.then(() => this.writeSnapshotToDisk());
    this.saveChain = next.catch(() => undefined);
    return next;
  }

  private async writeSnapshotToDisk(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });

    const payload = JSON.stringify(this.snapshot, null, 2);
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, payload, "utf8");
    await rename(tempPath, this.filePath);
  }

  listProjects(): ProjectList {
    return {
      projects: this.snapshot.projects,
      activeProjectId: this.snapshot.activeProjectId
    };
  }

  upsertProject(project: Project): Project {
    const validated = projectSchema.parse(project);
    const index = this.snapshot.projects.findIndex((item) => item.id === validated.id);

    if (index === -1) {
      this.snapshot.projects.push(validated);
    } else {
      this.snapshot.projects[index] = validated;
    }

    this.snapshot.activeProjectId = validated.id;
    return validated;
  }

  setActiveGuidelineId(projectId: string, guidelineId: string | null): void {
    const project = this.snapshot.projects.find((p) => p.id === projectId);
    if (!project) return;
    if (guidelineId === null) {
      delete project.activeGuidelineId;
    } else {
      project.activeGuidelineId = guidelineId;
    }
  }

  getActiveGuidelineId(projectId: string): string | null {
    const project = this.snapshot.projects.find((p) => p.id === projectId);
    return project?.activeGuidelineId ?? null;
  }

  listSessions(projectId: string | null): ReviewSessionList {
    const sessions = projectId
      ? this.snapshot.sessions.filter((session) => session.projectId === projectId)
      : this.snapshot.sessions;

    return { sessions };
  }

  upsertSession(session: ReviewSession): ReviewSession {
    const validated = reviewSessionSchema.parse(session);
    const index = this.snapshot.sessions.findIndex((item) => item.id === validated.id);

    if (index === -1) {
      this.snapshot.sessions.push(validated);
    } else {
      this.snapshot.sessions[index] = validated;
    }

    return validated;
  }

  appendAuditEntry(entry: Omit<AuditLogEntry, "id"> & { id?: string }): AuditLogEntry {
    const validated = auditLogEntrySchema.parse({
      id: entry.id ?? randomUUID(),
      ...entry
    });
    this.snapshot.auditLog.push(validated);
    return validated;
  }

  listAuditLog(): AuditLogList {
    return { entries: this.snapshot.auditLog };
  }

  getActiveAdapterId(): string | null {
    return this.snapshot.activeAdapterId;
  }

  setActiveAdapterId(adapterId: string | null): void {
    this.snapshot.activeAdapterId = adapterId;
  }

  upsertAgentRun(run: AgentRun): AgentRun {
    const validated = agentRunSchema.parse(run);
    const index = this.snapshot.agentRuns.findIndex((item) => item.id === validated.id);

    if (index === -1) {
      this.snapshot.agentRuns.push(validated);
    } else {
      this.snapshot.agentRuns[index] = validated;
    }

    return validated;
  }

  getAgentRun(runId: string): AgentRun | undefined {
    return this.snapshot.agentRuns.find((item) => item.id === runId);
  }

  appendAgentRunEvent(event: AgentRunEvent): AgentRunEvent {
    const validated = agentRunEventSchema.parse(event);
    this.snapshot.agentRunEvents.push(validated);
    return validated;
  }

  listAgentRunEvents(runId: string): AgentRunEvent[] {
    return this.snapshot.agentRunEvents.filter((event) => event.runId === runId);
  }

  upsertReviewChange(change: ReviewChange): ReviewChange {
    const validated = reviewChangeSchema.parse(change);
    const index = this.snapshot.reviewChanges.findIndex((item) => item.id === validated.id);

    if (index === -1) {
      this.snapshot.reviewChanges.push(validated);
    } else {
      this.snapshot.reviewChanges[index] = validated;
    }

    return validated;
  }

  getReviewChange(changeId: string): ReviewChange | undefined {
    return this.snapshot.reviewChanges.find((item) => item.id === changeId);
  }

  listReviewChanges(sessionId: string | null): ReviewChange[] {
    return sessionId
      ? this.snapshot.reviewChanges.filter((change) => change.sessionId === sessionId)
      : this.snapshot.reviewChanges;
  }

  upsertFinding(finding: UxCopyFinding): UxCopyFinding {
    const validated = uxCopyFindingSchema.parse(finding);
    const index = this.snapshot.findings.findIndex((item) => item.id === validated.id);

    if (index === -1) {
      this.snapshot.findings.push(validated);
    } else {
      this.snapshot.findings[index] = validated;
    }

    return validated;
  }

  listFindings(sessionId: string | null): UxCopyFinding[] {
    return sessionId
      ? this.snapshot.findings.filter((finding) => finding.sessionId === sessionId)
      : this.snapshot.findings;
  }

  upsertRewrite(rewrite: RewriteCandidate): RewriteCandidate {
    const validated = rewriteCandidateSchema.parse(rewrite);
    const index = this.snapshot.rewrites.findIndex((item) => item.id === validated.id);

    if (index === -1) {
      this.snapshot.rewrites.push(validated);
    } else {
      this.snapshot.rewrites[index] = validated;
    }

    return validated;
  }

  listRewrites(sessionId: string | null): RewriteCandidate[] {
    return sessionId
      ? this.snapshot.rewrites.filter((rewrite) => rewrite.sessionId === sessionId)
      : this.snapshot.rewrites;
  }

  upsertPasteTextConversation(conversation: PasteTextConversation): PasteTextConversation {
    const validated = pasteTextConversationSchema.parse(conversation);
    const index = this.snapshot.pasteTextConversations.findIndex((item) => item.id === validated.id);

    if (index === -1) {
      this.snapshot.pasteTextConversations.push(validated);
    } else {
      this.snapshot.pasteTextConversations[index] = validated;
    }

    return validated;
  }

  getPasteTextConversation(conversationId: string): PasteTextConversation | undefined {
    return this.snapshot.pasteTextConversations.find((item) => item.id === conversationId);
  }

  listPasteTextConversations(projectId: string | null): PasteTextConversation[] {
    return projectId
      ? this.snapshot.pasteTextConversations.filter((conversation) => conversation.projectId === projectId)
      : this.snapshot.pasteTextConversations;
  }
}
