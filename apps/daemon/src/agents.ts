import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { AgentAdapterList, AgentRun, AgentRunEvent } from "@writer/contracts";
import {
  createDefaultAgentRegistry,
  detectCliAdapter,
  getCliAdapterConfig,
  smokeCliAdapter,
  type AgentAdapterRegistry,
  type AgentRunHandle
} from "@writer/agent-adapters";

import type { DaemonState } from "./state";

const createAgentRunInputSchema = z.object({
  sessionId: z.string().min(1),
  adapterId: z.string().min(1).optional(),
  prompt: z.string().min(1)
});

const setActiveAdapterInputSchema = z.object({
  adapterId: z.string().min(1).nullable()
});

const smokeAdapterInputSchema = z.object({
  adapterId: z.string().min(1)
});

export type AgentRunResult = {
  run: AgentRun;
  events: AgentRunEvent[];
};

type ActiveRun = {
  handle: AgentRunHandle;
};

let defaultRegistry: AgentAdapterRegistry | null = null;

function getRegistry(): AgentAdapterRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultAgentRegistry();
  }

  return defaultRegistry;
}

export async function getAgentAdapterList(state: DaemonState): Promise<AgentAdapterList> {
  const registry = getRegistry();
  const adapters = await Promise.all(registry.list().map((impl) => impl.detect().then((result) => result.adapter)));
  const storedActive = state.store.getActiveAdapterId();
  const fallback =
    adapters.find((adapter) => adapter.available && adapter.id !== "echo")?.id ??
    adapters.find((adapter) => adapter.available)?.id ??
    null;
  const activeAdapterId = storedActive ?? fallback;

  if (!storedActive && activeAdapterId) {
    state.store.setActiveAdapterId(activeAdapterId);
    await state.store.save();
  }

  return { adapters, activeAdapterId };
}

export async function refreshAgentDetection(state: DaemonState): Promise<AgentAdapterList> {
  return getAgentAdapterList(state);
}

export async function smokeAgentAdapter(state: DaemonState, input: unknown) {
  const parsed = smokeAdapterInputSchema.parse(input);
  const config = getCliAdapterConfig(parsed.adapterId);

  if (!config) {
    throw new Error(`Unknown or unsupported adapter: ${parsed.adapterId}`);
  }

  const detection = await detectCliAdapter(config);

  if (!detection.adapter.available || !detection.adapter.executablePath) {
    return {
      ok: false,
      adapterId: parsed.adapterId,
      adapter: detection.adapter,
      message: detection.adapter.setupMessage ?? "Adapter is not available."
    };
  }

  const smoke = await smokeCliAdapter(config, detection.adapter.executablePath);

  state.store.appendAuditEntry({
    type: "tool_attempt",
    timestamp: new Date().toISOString(),
    actor: "user",
    summary: `Agent smoke ${parsed.adapterId}: ${smoke.ok ? "ok" : "failed"}`,
    details: { adapterId: parsed.adapterId, ok: smoke.ok, message: smoke.message }
  });
  await state.store.save();

  return {
    ok: smoke.ok,
    adapterId: parsed.adapterId,
    adapter: detection.adapter,
    output: smoke.output,
    message: smoke.message
  };
}

export async function setActiveAdapter(state: DaemonState, input: unknown): Promise<AgentAdapterList> {
  const parsed = setActiveAdapterInputSchema.parse(input);
  state.store.setActiveAdapterId(parsed.adapterId);
  await state.store.save();
  return getAgentAdapterList(state);
}

export async function startAgentRun(state: DaemonState, input: unknown): Promise<AgentRunResult> {
  const parsed = createAgentRunInputSchema.parse(input);
  const sessions = state.store.listSessions(null);

  if (!sessions.sessions.some((session) => session.id === parsed.sessionId)) {
    throw new Error("Session not found");
  }

  const list = await getAgentAdapterList(state);
  const adapterId = parsed.adapterId ?? list.activeAdapterId;
  const adapter = list.adapters.find((item) => item.id === adapterId);

  if (!adapterId || !adapter) {
    throw new Error("No agent adapter selected");
  }

  if (!adapter.available) {
    throw new Error(`Agent adapter unavailable: ${adapterId}`);
  }

  const impl = getRegistry().get(adapterId);

  if (!impl) {
    throw new Error(`Agent adapter not registered: ${adapterId}`);
  }

  const handle = await impl.run({
    sessionId: parsed.sessionId,
    prompt: parsed.prompt
  });

  const run = handle.run;

  state.activeRuns.set(run.id, { handle });
  state.store.upsertAgentRun(run);
  linkRunToSession(state, run);
  await recordRunLifecycle(state, run, "started");

  const events: AgentRunEvent[] = [];

  for await (const event of handle.events) {
    const normalized: AgentRunEvent = {
      ...event,
      id: event.id || `evt-${randomUUID()}`,
      runId: run.id,
      timestamp: event.timestamp || new Date().toISOString()
    };
    events.push(normalized);
    state.store.appendAgentRunEvent(normalized);
  }

  state.store.upsertAgentRun(handle.run);
  state.activeRuns.delete(run.id);
  await recordRunLifecycle(state, handle.run, handle.run.status);
  await state.store.save();

  return { run: state.store.getAgentRun(run.id) ?? handle.run, events };
}

export async function cancelAgentRun(state: DaemonState, runId: string): Promise<AgentRun> {
  const active = state.activeRuns.get(runId);

  if (active) {
    await active.handle.cancel();
    const run = { ...active.handle.run };
    state.store.upsertAgentRun(run);
    state.store.appendAgentRunEvent({
      id: `evt-${runId}-canceled`,
      runId,
      type: "canceled",
      timestamp: run.endedAt ?? new Date().toISOString(),
      payload: {}
    });
    state.activeRuns.delete(runId);
    await recordRunLifecycle(state, run, "canceled");
    await state.store.save();
    return run;
  }

  const existing = state.store.getAgentRun(runId);

  if (!existing) {
    throw new Error("Agent run not found");
  }

  if (existing.status === "running") {
    const canceled: AgentRun = {
      ...existing,
      status: "canceled",
      endedAt: new Date().toISOString()
    };
    state.store.upsertAgentRun(canceled);
    await recordRunLifecycle(state, canceled, "canceled");
    await state.store.save();
    return canceled;
  }

  return existing;
}

export function getAgentRunDetail(state: DaemonState, runId: string): AgentRunResult | null {
  const run = state.store.getAgentRun(runId);

  if (!run) {
    return null;
  }

  return {
    run,
    events: state.store.listAgentRunEvents(runId)
  };
}

function linkRunToSession(state: DaemonState, run: AgentRun): void {
  const sessions = state.store.listSessions(null);
  const session = sessions.sessions.find((item) => item.id === run.sessionId);

  if (!session) {
    return;
  }

  if (!session.agentRunIds.includes(run.id)) {
    state.store.upsertSession({
      ...session,
      agentRunIds: [...session.agentRunIds, run.id],
      updatedAt: new Date().toISOString()
    });
  }
}

async function recordRunLifecycle(state: DaemonState, run: AgentRun, phase: string): Promise<void> {
  state.store.appendAuditEntry({
    type: "agent_run_lifecycle",
    timestamp: new Date().toISOString(),
    actor: "system",
    summary: `Agent run ${phase}: ${run.adapterId}`,
    details: {
      runId: run.id,
      sessionId: run.sessionId,
      status: run.status,
      phase
    }
  });
}
