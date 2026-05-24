import { z } from "zod";

import { connectionDiagnosticSchema } from "./connection-diagnostic";
import { uxCopyFindingSchema } from "./finding";
import { reviewChangeSchema } from "./review-change";
import { rewriteCandidateSchema } from "./rewrite-candidate";

export const reviewQueueSchema = z.object({
  findings: z.array(uxCopyFindingSchema),
  rewrites: z.array(rewriteCandidateSchema),
  changes: z.array(reviewChangeSchema),
  diagnostic: connectionDiagnosticSchema.optional()
});

export type ReviewQueue = z.infer<typeof reviewQueueSchema>;

export function parseReviewQueue(payload: unknown): ReviewQueue {
  return reviewQueueSchema.parse(payload);
}
