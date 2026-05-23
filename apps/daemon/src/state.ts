import { randomUUID } from "node:crypto";

import {
  type AgentAdapterList,
  type McpServerList,
  type PermissionRequest,
  type Project,
  type ProjectList,
  type ReviewSession,
  type ReviewSessionList,
  type ToolList,
  createProjectInputSchema,
  createReviewSessionInputSchema,
  parsePermissionDecisionInput
} from "@writer/contracts";
import { PlatformStore } from "@writer/storage";

export type DaemonState = {
  store: PlatformStore;
  permissionRequests: PermissionRequest[];
};

export async function createDaemonState(): Promise<DaemonState> {
  const store = new PlatformStore();
  await store.load();

  return {
    store,
    permissionRequests: []
  };
}

export function listProjects(state: DaemonState): ProjectList {
  return state.store.listProjects();
}

export async function createProject(state: DaemonState, input: unknown): Promise<Project> {
  const parsed = createProjectInputSchema.parse(input);
  const timestamp = new Date().toISOString();
  const project = state.store.upsertProject({
    id: randomUUID(),
    name: parsed.name,
    rootPath: parsed.rootPath,
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await state.store.save();
  return project;
}

export function listSessions(state: DaemonState, projectId: string | null): ReviewSessionList {
  return state.store.listSessions(projectId);
}

export async function createSession(state: DaemonState, input: unknown): Promise<ReviewSession> {
  const parsed = createReviewSessionInputSchema.parse(input);
  const timestamp = new Date().toISOString();

  const session = state.store.upsertSession({
    id: randomUUID(),
    projectId: parsed.projectId,
    sourceType: parsed.sourceType,
    scope: parsed.scope,
    status: "draft",
    agentRunIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  });

  await state.store.save();
  return session;
}

export function getAgentAdapterList(): AgentAdapterList {
  return {
    adapters: [
      {
        id: "codex",
        displayName: "Codex",
        available: false,
        setupMessage: "Install the Codex CLI and ensure it is on PATH.",
        capabilities: [{ id: "review", label: "UX copy review", enabled: false }]
      },
      {
        id: "cursor-agent",
        displayName: "Cursor Agent",
        available: false,
        setupMessage: "Configure Cursor Agent CLI access in Settings.",
        capabilities: [{ id: "review", label: "UX copy review", enabled: false }]
      }
    ],
    activeAdapterId: null
  };
}

export function getToolList(): ToolList {
  return { tools: [] };
}

export function getMcpServerList(): McpServerList {
  return {
    servers: [
      {
        id: "figma",
        name: "Figma MCP",
        enabled: false,
        status: "disconnected",
        capabilities: ["figma.read", "figma.write"],
        errorMessage: "Not configured"
      }
    ]
  };
}

export function listPermissionRequests(state: DaemonState): PermissionRequest[] {
  return state.permissionRequests;
}

export function decidePermission(state: DaemonState, input: unknown): PermissionRequest {
  const parsed = parsePermissionDecisionInput(input);
  const request = state.permissionRequests.find((item) => item.id === parsed.requestId);

  if (!request) {
    throw new Error("Permission request not found");
  }

  request.decision = parsed.decision;
  request.decidedAt = new Date().toISOString();
  request.decidedBy = "user";
  return request;
}
