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

export type DaemonState = {
  projects: Project[];
  activeProjectId: string | null;
  sessions: ReviewSession[];
  permissionRequests: PermissionRequest[];
};

export function createDaemonState(): DaemonState {
  return {
    projects: [],
    activeProjectId: null,
    sessions: [],
    permissionRequests: []
  };
}

export function listProjects(state: DaemonState): ProjectList {
  return {
    projects: state.projects,
    activeProjectId: state.activeProjectId
  };
}

export function createProject(state: DaemonState, input: unknown): Project {
  const parsed = createProjectInputSchema.parse(input);
  const timestamp = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    name: parsed.name,
    rootPath: parsed.rootPath,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  state.projects.push(project);
  state.activeProjectId = project.id;
  return project;
}

export function listSessions(state: DaemonState, projectId: string | null): ReviewSessionList {
  const sessions = projectId
    ? state.sessions.filter((session) => session.projectId === projectId)
    : state.sessions;

  return { sessions };
}

export function createSession(state: DaemonState, input: unknown): ReviewSession {
  const parsed = createReviewSessionInputSchema.parse(input);
  const timestamp = new Date().toISOString();

  const session: ReviewSession = {
    id: randomUUID(),
    projectId: parsed.projectId,
    sourceType: parsed.sourceType,
    scope: parsed.scope,
    status: "draft",
    agentRunIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };

  state.sessions.push(session);
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
