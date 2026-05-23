import { z } from "zod";

import { reviewChangeSchema } from "./review-change";
import { rewriteCandidateSchema } from "./rewrite-candidate";
import { uxCopyFindingSchema } from "./finding";

export const reportArtifactSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  projectId: z.string().min(1),
  sourceType: z.enum(["figma", "pasted_text", "spreadsheet"]),
  scope: z.record(z.string(), z.unknown()),
  generatedAt: z.iso.datetime(),
  findings: z.array(uxCopyFindingSchema),
  rewrites: z.array(rewriteCandidateSchema),
  changes: z.array(reviewChangeSchema),
  writebackSummary: z
    .object({
      applied: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative()
    })
    .optional()
});

export type ReportArtifact = z.infer<typeof reportArtifactSchema>;

export function parseReportArtifact(payload: unknown): ReportArtifact {
  return reportArtifactSchema.parse(payload);
}
