import { z } from "zod";

import { changeStatusSchema } from "./review-change";

/** Structured citation linking a rewrite suggestion to its source guideline rule or term. */
export const guidelineSourceSchema = z.object({
  layer: z.enum(["company-base", "software-writing", "product"]),
  ruleId: z.string().optional(),
  termId: z.string().optional(),
  excerpt: z.string().optional()
});

export const rewriteCandidateSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  findingId: z.string().min(1).optional(),
  sourceId: z.string().min(1),
  before: z.string(),
  after: z.string(),
  rationale: z.string().min(1),
  guidelineSource: guidelineSourceSchema.optional(),
  status: changeStatusSchema
});

export const rewriteCandidateListSchema = z.object({
  candidates: z.array(rewriteCandidateSchema)
});

export type GuidelineSource = z.infer<typeof guidelineSourceSchema>;
export type RewriteCandidate = z.infer<typeof rewriteCandidateSchema>;
export type RewriteCandidateList = z.infer<typeof rewriteCandidateListSchema>;

export function parseRewriteCandidate(payload: unknown): RewriteCandidate {
  return rewriteCandidateSchema.parse(payload);
}
