import { z } from "zod";

export const changeStatusSchema = z.enum([
  "detected",
  "proposed",
  "approved",
  "edited",
  "rejected",
  "queued_for_writeback",
  "applied",
  "failed",
  "skipped"
]);

export const reviewChangeSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  sourceId: z.string().min(1),
  status: changeStatusSchema,
  /** Visible UI copy before the change — surface text only, no MCP/codegen payload. */
  before: z.string(),
  /** Visible UI copy after the change — surface text only, no MCP/codegen payload. */
  after: z.string(),
  rationale: z.string().optional(),
  updatedAt: z.iso.datetime(),
  updatedBy: z.enum(["system", "user", "agent"])
});

export const reviewChangeListSchema = z.object({
  changes: z.array(reviewChangeSchema)
});

export const changeTransitionInputSchema = z.object({
  changeId: z.string().min(1),
  nextStatus: changeStatusSchema,
  after: z.string().optional(),
  actor: z.enum(["system", "user", "agent"]).default("user")
});

export type ChangeStatus = z.infer<typeof changeStatusSchema>;
export type ReviewChange = z.infer<typeof reviewChangeSchema>;
export type ReviewChangeList = z.infer<typeof reviewChangeListSchema>;
export type ChangeTransitionInput = z.infer<typeof changeTransitionInputSchema>;

export function parseReviewChange(payload: unknown): ReviewChange {
  return reviewChangeSchema.parse(payload);
}

export function parseChangeTransitionInput(payload: unknown): ChangeTransitionInput {
  return changeTransitionInputSchema.parse(payload);
}
