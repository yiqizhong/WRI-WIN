import { z } from "zod";

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
  capabilities: z.array(z.string().min(1))
});

export const mcpServerListSchema = z.object({
  servers: z.array(mcpServerSchema)
});

export type McpConnectionStatus = z.infer<typeof mcpConnectionStatusSchema>;
export type McpServer = z.infer<typeof mcpServerSchema>;
export type McpServerList = z.infer<typeof mcpServerListSchema>;

export function parseMcpServerList(payload: unknown): McpServerList {
  return mcpServerListSchema.parse(payload);
}
