import { z } from "zod";

import { changeStatusSchema } from "./review-change";

export const rewriteCandidateSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  findingId: z.string().min(1).optional(),
  sourceId: z.string().min(1),
  before: z.string(),
  after: z.string(),
  rationale: z.string().min(1),
  status: changeStatusSchema
});

export const rewriteCandidateListSchema = z.object({
  candidates: z.array(rewriteCandidateSchema)
});

export type RewriteCandidate = z.infer<typeof rewriteCandidateSchema>;
export type RewriteCandidateList = z.infer<typeof rewriteCandidateListSchema>;

export function parseRewriteCandidate(payload: unknown): RewriteCandidate {
  return rewriteCandidateSchema.parse(payload);
}
