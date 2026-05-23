import { z } from "zod";

export const toolRiskLevelSchema = z.enum(["read_only", "network", "write", "destructive"]);

export const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1),
  capability: z.string().min(1),
  risk: toolRiskLevelSchema,
  description: z.string().optional()
});

export const toolListSchema = z.object({
  tools: z.array(toolSchema)
});

export type ToolRiskLevel = z.infer<typeof toolRiskLevelSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type ToolList = z.infer<typeof toolListSchema>;

export function parseToolList(payload: unknown): ToolList {
  return toolListSchema.parse(payload);
}
