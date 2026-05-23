import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { AgentAdapterList, AgentRun, AgentRunEvent, AgentSmokeResult, AgentAdapter } from "@writer/contracts";
import { isLlmProviderAdapterId } from "@writer/contracts";
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

export type AgentRunLaunch = {
  run: AgentRun;
  completion: Promise<AgentRunResult>;
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
  const adapters = (
    await Promise.all(registry.list().map((impl) => impl.detect().then((result) => result.adapter)))
  ).filter((adapter) => isLlmProviderAdapterId(adapter.id));
  let storedActive = state.store.getActiveAdapterId();

  if (storedActive && !isLlmProviderAdapterId(storedActive)) {
    storedActive = null;
    state.store.setActiveAdapterId(null);
    await state.store.save();
  }

  const fallback =
    adapters.find((adapter) => adapter.available)?.id ?? null;
  const activeAdapterId = storedActive ?? fallback;

  if (!storedActive && activeAdapterId) {
    state.store.setActiveAdapterId(activeAdapterId);
    await state.store.save();
  }

  return { adapters, activeAdapterId: activeAdapterId ?? null };
}

async function resolveAdapterForRun(
  state: DaemonState,
  preferredAdapterId?: string
): Promise<{ adapterId: string; adapter: AgentAdapter }> {
  const storedActive = state.store.getActiveAdapterId();
  const adapterId = preferredAdapterId ?? storedActive;

  if (!adapterId) {
    throw new Error("No agent adapter selected");
  }

  const impl = getRegistry().get(adapterId);

  if (!impl) {
    throw new Error(`Agent adapter not registered: ${adapterId}`);
  }

  const adapter = (await impl.detect()).adapter;

  if (!adapter.available) {
    throw new Error(`Agent adapter unavailable: ${adapterId}`);
  }

  return { adapterId, adapter };
}

export async function refreshAgentDetection(state: DaemonState): Promise<AgentAdapterList> {
  return getAgentAdapterList(state);
}

export async function smokeAgentAdapter(state: DaemonState, input: unknown): Promise<AgentSmokeResult> {
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
      diagnostic: detection.adapter.diagnostic,
      message: detection.adapter.setupMessage ?? "Adapter is not available."
    };
  }

  const smoke = await smokeCliAdapter(config, detection.adapter.executablePath);

  state.store.appendAuditEntry({
    type: "tool_attempt",
    timestamp: new Date().toISOString(),
    actor: "user",
    summary: `Agent smoke ${parsed.adapterId}: ${smoke.ok ? "ok" : "failed"}`,
    details: {
      adapterId: parsed.adapterId,
      ok: smoke.ok,
      message: smoke.message,
      diagnosticCode: smoke.diagnostic?.code
    }
  });
  await state.store.save();

  return {
    ok: smoke.ok,
    adapterId: parsed.adapterId,
    adapter: detection.adapter,
    diagnostic: smoke.diagnostic,
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

export async function launchAgentRun(state: DaemonState, input: unknown): Promise<AgentRunLaunch> {
  const parsed = createAgentRunInputSchema.parse(input);
  const sessions = state.store.listSessions(null);

  if (!sessions.sessions.some((session) => session.id === parsed.sessionId)) {
    throw new Error("Session not found");
  }

  const { adapterId } = await resolveAdapterForRun(state, parsed.adapterId);
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
  await state.store.save();

  return {
    run,
    completion: consumeAgentRun(state, run.id, handle)
  };
}

export async function startAgentRun(state: DaemonState, input: unknown): Promise<AgentRunResult> {
  const launch = await launchAgentRun(state, input);
  return launch.completion;
}

async function consumeAgentRun(
  state: DaemonState,
  runId: string,
  handle: AgentRunHandle
): Promise<AgentRunResult> {
  const run = handle.run;
  const events: AgentRunEvent[] = [];

  try {
    for await (const event of handle.events) {
      const normalized: AgentRunEvent = {
        ...event,
        id: event.id || `evt-${randomUUID()}`,
        runId,
        timestamp: event.timestamp || new Date().toISOString()
      };
      events.push(normalized);
      state.store.appendAgentRunEvent(normalized);
    }

    state.store.upsertAgentRun(handle.run);
    await recordRunLifecycle(state, handle.run, handle.run.status);
    await state.store.save();

    return { run: state.store.getAgentRun(runId) ?? handle.run, events };
  } finally {
    state.activeRuns.delete(runId);
  }
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
