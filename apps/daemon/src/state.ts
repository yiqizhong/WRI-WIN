import { randomUUID } from "node:crypto";

import {
  type McpServerList,
  type PermissionRequest,
  type Project,
  type ProjectList,
  type ReviewSession,
  type ReviewSessionList,
  createProjectInputSchema,
  createReviewSessionInputSchema,
  parsePermissionDecisionInput
} from "@writer/contracts";
import type { AgentRunHandle } from "@writer/agent-adapters";
import { PlatformStore } from "@writer/storage";

import {
  cancelAgentRun,
  getAgentAdapterList,
  getAgentRunDetail,
  refreshAgentDetection,
  smokeAgentAdapter,
  setActiveAdapter,
  startAgentRun,
  type AgentRunResult
} from "./agents";
import { createDefaultMcpState, getMcpServerList, setMcpServerEnabled, smokeFigmaRead, smokeFigmaWrite } from "./mcp";
import type { McpRuntimeState } from "./mcp";
import { createPermissionRequest, executeTool, getToolList } from "./tools";

export type DaemonState = {
  store: PlatformStore;
  permissionRequests: PermissionRequest[];
  activeRuns: Map<string, { handle: AgentRunHandle }>;
  mcp: McpRuntimeState;
};

export async function createDaemonState(): Promise<DaemonState> {
  const store = new PlatformStore();
  await store.load();
  const state: DaemonState = {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: createDefaultMcpState()
  };

  await refreshAgentDetection(state);
  return state;
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

export {
  getAgentAdapterList,
  refreshAgentDetection,
  smokeAgentAdapter,
  setActiveAdapter,
  startAgentRun,
  cancelAgentRun,
  getAgentRunDetail,
  getToolList,
  createPermissionRequest,
  executeTool,
  getMcpServerList,
  setMcpServerEnabled,
  smokeFigmaRead,
  smokeFigmaWrite,
  type AgentRunResult
};

export function listPermissionRequests(state: DaemonState): PermissionRequest[] {
  return state.permissionRequests;
}

export async function decidePermission(state: DaemonState, input: unknown): Promise<PermissionRequest> {
  const parsed = parsePermissionDecisionInput(input);
  const request = state.permissionRequests.find((item) => item.id === parsed.requestId);

  if (!request) {
    throw new Error("Permission request not found");
  }

  request.decision = parsed.decision;
  request.decidedAt = new Date().toISOString();
  request.decidedBy = "user";

  state.store.appendAuditEntry({
    type: "permission_decision",
    timestamp: request.decidedAt,
    actor: "user",
    summary: `${parsed.decision} ${request.toolName}`,
    details: {
      requestId: request.id,
      toolId: request.toolId,
      risk: request.risk,
      sessionId: request.sessionId,
      runId: request.runId
    }
  });
  await state.store.save();

  return request;
}
