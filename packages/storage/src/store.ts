import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  type AgentRun,
  type AgentRunEvent,
  type AuditLogEntry,
  type AuditLogList,
  type LocalModelState,
  type DevinProviderSettings,
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
  localModelStateSchema,
  devinProviderSettingsSchema,
  projectListSchema,
  projectSchema,
  reviewChangeSchema,
  reviewSessionListSchema,
  reviewSessionSchema,
  rewriteCandidateSchema,
  uxCopyFindingSchema,
  pasteTextConversationSchema,
  type PasteTextAttachment,
} from "@writer/contracts";

import { getPasteTextParseResultPath } from "./paste-text-paths";

const speculativeDecodingStateSchema = z.object({
  enabled: z.boolean(),
  lastError: z.string().optional()
});

export const STORAGE_VERSION = 1;

export const AUDIT_LOG_CAP = 10_000;

const TERMINAL_AGENT_RUN_STATUSES = new Set(["completed", "failed", "canceled"]);

export type SpeculativeDecodingState = {
  enabled: boolean;
  lastError?: string;
};

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
  localModel: LocalModelState | null;
  speculativeDecoding: SpeculativeDecodingState;
  devinProviderSettings: DevinProviderSettings;
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
      pasteTextConversations: [],
      localModel: null,
      speculativeDecoding: { enabled: false },
      devinProviderSettings: devinProviderSettingsSchema.parse({})
    };
  }

  async load(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });

    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PlatformStoreSnapshot;

      this.snapshot = {
        version: parsed.version ?? STORAGE_VERSION,
        projects: (parsed.projects ?? []).map((raw) => {
          const item = raw as Project & { activeGuidelineId?: string };
          const { activeGuidelineId: _dropped, ...rest } = item;
          return projectSchema.parse(rest);
        }),
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
        pasteTextConversations: (parsed.pasteTextConversations ?? []).flatMap((conversation) => {
          const result = pasteTextConversationSchema.safeParse(conversation);
          return result.success ? [result.data] : [];
        }),
        localModel: parsed.localModel
          ? (() => {
              const r = localModelStateSchema.safeParse(parsed.localModel);
              return r.success ? r.data : null;
            })()
          : null,
        speculativeDecoding: (() => {
          const raw = (parsed as { speculativeDecoding?: unknown }).speculativeDecoding;
          if (!raw) return { enabled: false };
          const r = speculativeDecodingStateSchema.safeParse(raw);
          return r.success ? r.data : { enabled: false };
        })(),
        devinProviderSettings: devinProviderSettingsSchema.parse(parsed.devinProviderSettings ?? {})
      };

      const migrated = await this.migrateLoadedSnapshot();
      if (migrated) {
        await this.save();
      }
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

  setActiveProductId(projectId: string, productId: string | null): void {
    const project = this.snapshot.projects.find((p) => p.id === projectId);
    if (!project) return;
    if (productId === null) {
      delete project.activeProductId;
    } else {
      project.activeProductId = productId;
    }
  }

  getActiveProductId(projectId: string): string | null {
    const project = this.snapshot.projects.find((p) => p.id === projectId);
    return project?.activeProductId ?? null;
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
    if (this.snapshot.auditLog.length > AUDIT_LOG_CAP) {
      this.snapshot.auditLog.splice(0, this.snapshot.auditLog.length - AUDIT_LOG_CAP);
    }
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

  getDevinProviderSettings(): DevinProviderSettings {
    return this.snapshot.devinProviderSettings;
  }

  setDevinProviderSettings(settings: Partial<DevinProviderSettings>): DevinProviderSettings {
    const next = devinProviderSettingsSchema.parse({
      ...this.snapshot.devinProviderSettings,
      ...settings
    });
    this.snapshot.devinProviderSettings = next;
    return next;
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

  purgeAgentRunEvents(runId: string): void {
    this.snapshot.agentRunEvents = this.snapshot.agentRunEvents.filter((event) => event.runId !== runId);
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

  getLocalModel(): LocalModelState | null {
    return this.snapshot.localModel;
  }

  setLocalModel(state: LocalModelState): void {
    this.snapshot.localModel = localModelStateSchema.parse(state);
  }

  clearLocalModel(): void {
    this.snapshot.localModel = null;
  }

  getSpeculativeDecoding(): SpeculativeDecodingState {
    return { ...this.snapshot.speculativeDecoding };
  }

  setSpeculativeDecoding(value: SpeculativeDecodingState): void {
    this.snapshot.speculativeDecoding = speculativeDecodingStateSchema.parse(value);
  }

  private async migrateLoadedSnapshot(): Promise<boolean> {
    let migrated = false;

    for (const conversation of this.snapshot.pasteTextConversations) {
      const attachment = conversation.attachment;
      if (!attachment?.parseResult) {
        continue;
      }

      const parseResultPath =
        attachment.parseResultPath ?? getPasteTextParseResultPath(this.dataDir, conversation.id);

      try {
        await access(parseResultPath);
      } catch {
        await mkdir(dirname(parseResultPath), { recursive: true });
        await writeFile(parseResultPath, JSON.stringify(attachment.parseResult), "utf8");
      }

      const nextAttachment: PasteTextAttachment = {
        ...attachment,
        parseResultPath,
        parseResult: undefined
      };

      conversation.attachment = nextAttachment;
      migrated = true;
    }

    for (const run of this.snapshot.agentRuns) {
      if (!TERMINAL_AGENT_RUN_STATUSES.has(run.status)) {
        continue;
      }

      const before = this.snapshot.agentRunEvents.length;
      this.purgeAgentRunEvents(run.id);
      if (this.snapshot.agentRunEvents.length !== before) {
        migrated = true;
      }
    }

    return migrated;
  }
}
