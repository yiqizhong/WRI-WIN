import { z } from "zod";

import { connectionDiagnosticSchema } from "./connection-diagnostic";
import { designContextSchema } from "./design-context";
import { figmaTextExtractionSchema } from "./figma-text-node";
import { guidelineSnapshotSchema } from "./guideline";

export const reviewSourceTypeSchema = z.enum(["figma", "pasted_text", "spreadsheet"]);

export const reviewSessionStatusSchema = z.enum([
  "draft",
  "running",
  "reviewing",
  "completed",
  "canceled"
]);

export const reviewSessionSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  sourceType: reviewSourceTypeSchema,
  scope: z.record(z.string(), z.unknown()),
  status: reviewSessionStatusSchema,
  agentRunIds: z.array(z.string().min(1)),
  figmaExtraction: figmaTextExtractionSchema.optional(),
  designContext: designContextSchema.optional(),
  diagnostic: connectionDiagnosticSchema.optional(),
  guidelineSnapshot: guidelineSnapshotSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});

export const createReviewSessionInputSchema = z.object({
  projectId: z.string().min(1),
  sourceType: reviewSourceTypeSchema,
  scope: z.record(z.string(), z.unknown()).default({})
});

export const reviewSessionListSchema = z.object({
  sessions: z.array(reviewSessionSchema)
});

export type ReviewSourceType = z.infer<typeof reviewSourceTypeSchema>;
export type ReviewSessionStatus = z.infer<typeof reviewSessionStatusSchema>;
export type ReviewSession = z.infer<typeof reviewSessionSchema>;
export type CreateReviewSessionInput = z.infer<typeof createReviewSessionInputSchema>;
export type ReviewSessionList = z.infer<typeof reviewSessionListSchema>;

export function parseReviewSession(payload: unknown): ReviewSession {
  return reviewSessionSchema.parse(payload);
}

export function parseReviewSessionList(payload: unknown): ReviewSessionList {
  return reviewSessionListSchema.parse(payload);
}
