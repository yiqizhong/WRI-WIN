import { z } from "zod";

export const writebackItemResultSchema = z.object({
  changeId: z.string().min(1),
  sourceId: z.string().min(1),
  status: z.enum(["applied", "failed", "skipped"]),
  message: z.string().optional()
});

export const writebackResultSchema = z.object({
  sessionId: z.string().min(1),
  results: z.array(writebackItemResultSchema),
  completedAt: z.iso.datetime(),
  permissionRequestId: z.string().min(1).optional()
});

export type WritebackItemResult = z.infer<typeof writebackItemResultSchema>;
export type WritebackResult = z.infer<typeof writebackResultSchema>;

export function parseWritebackResult(payload: unknown): WritebackResult {
  return writebackResultSchema.parse(payload);
}
