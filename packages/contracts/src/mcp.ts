import { z } from "zod";

import { connectionDiagnosticSchema } from "./connection-diagnostic";

export const mcpCallToolResultSchema = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  diagnostic: connectionDiagnosticSchema.optional()
});

export type McpCallToolResult = z.infer<typeof mcpCallToolResultSchema>;
