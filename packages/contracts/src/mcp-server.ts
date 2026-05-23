import { z } from "zod";

import { connectionDiagnosticSchema } from "./connection-diagnostic";

export const mcpConnectionStatusSchema = z.enum([
  "disconnected",
  "connecting",
  "connected",
  "error"
]);

export const mcpServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  status: mcpConnectionStatusSchema,
  command: z.string().min(1).optional(),
  errorMessage: z.string().optional(),
  diagnostic: connectionDiagnosticSchema.optional(),
  tools: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().optional()
    })
  ).optional(),
  capabilities: z.array(z.string().min(1))
});

export const mcpServerListSchema = z.object({
  servers: z.array(mcpServerSchema)
});

export const mcpSmokeResultSchema = z.object({
  ok: z.boolean(),
  serverId: z.string().min(1),
  toolName: z.string().min(1).optional(),
  diagnostic: connectionDiagnosticSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  result: z.unknown().optional()
});

export type McpConnectionStatus = z.infer<typeof mcpConnectionStatusSchema>;
export type McpServer = z.infer<typeof mcpServerSchema>;
export type McpServerList = z.infer<typeof mcpServerListSchema>;
export type McpSmokeResult = z.infer<typeof mcpSmokeResultSchema>;

export function parseMcpServerList(payload: unknown): McpServerList {
  return mcpServerListSchema.parse(payload);
}

export function parseMcpSmokeResult(payload: unknown): McpSmokeResult {
  return mcpSmokeResultSchema.parse(payload);
}
