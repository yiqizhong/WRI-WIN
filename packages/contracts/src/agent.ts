import { z } from "zod";

export const agentCapabilitySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  enabled: z.boolean()
});

export const agentRuntimeKindSchema = z.enum(["local", "hybrid"]);

export const agentAuthStateSchema = z.enum(["ready", "needs_auth", "unknown"]);

export const agentAdapterSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  available: z.boolean(),
  executablePath: z.string().min(1).optional(),
  setupMessage: z.string().optional(),
  runtimeKind: agentRuntimeKindSchema.optional(),
  authState: agentAuthStateSchema.optional(),
  capabilities: z.array(agentCapabilitySchema)
});

export const agentAdapterListSchema = z.object({
  adapters: z.array(agentAdapterSchema),
  activeAdapterId: z.string().min(1).nullable()
});

export const agentRunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "canceled"
]);

export const agentRunEventTypeSchema = z.enum([
  "text",
  "tool_request",
  "error",
  "completed",
  "canceled"
]);

export const agentRunEventSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  type: agentRunEventTypeSchema,
  timestamp: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown())
});

export const agentRunSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  adapterId: z.string().min(1),
  status: agentRunStatusSchema,
  prompt: z.string().min(1),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().optional()
});

export type AgentCapability = z.infer<typeof agentCapabilitySchema>;
export type AgentRuntimeKind = z.infer<typeof agentRuntimeKindSchema>;
export type AgentAuthState = z.infer<typeof agentAuthStateSchema>;
export type AgentAdapter = z.infer<typeof agentAdapterSchema>;
export type AgentAdapterList = z.infer<typeof agentAdapterListSchema>;
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;
export type AgentRunEventType = z.infer<typeof agentRunEventTypeSchema>;
export type AgentRunEvent = z.infer<typeof agentRunEventSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;

export function parseAgentAdapterList(payload: unknown): AgentAdapterList {
  return agentAdapterListSchema.parse(payload);
}

export function parseAgentRun(payload: unknown): AgentRun {
  return agentRunSchema.parse(payload);
}

export function parseAgentRunEvent(payload: unknown): AgentRunEvent {
  return agentRunEventSchema.parse(payload);
}
