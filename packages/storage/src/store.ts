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
  type ReviewSession,
  type ReviewSessionList,
  agentRunEventSchema,
  agentRunSchema,
  auditLogListSchema,
  auditLogEntrySchema,
  projectListSchema,
  projectSchema,
  reviewSessionListSchema,
  reviewSessionSchema
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
      activeAdapterId: null
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
        activeAdapterId: parsed.activeAdapterId ?? null
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
}
