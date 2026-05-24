import { z } from "zod";

import { changeStatusSchema } from "./review-change";
import { surfaceSchema } from "./guideline";

export const issueSeveritySchema = z.enum(["critical", "major", "minor", "suggestion"]);
export const issueTypeSchema = z.enum([
  "tone",
  "clarity",
  "consistency",
  "terminology",
  "actionability",
  "accessibility",
  "grammar"
]);

export const findingEvidenceSchema = z.object({
  quote: z.string().min(1),
  surface: surfaceSchema,
  sourceNodeId: z.string().min(1)
});

export const findingSourceSchema = z.enum(["llm", "glossary"]);

export const uxCopyFindingSchema = z
  .object({
    id: z.string().min(1),
    sessionId: z.string().min(1),
    sourceId: z.string().min(1),
    sourceType: z.enum(["figma", "pasted_text", "spreadsheet"]),
    location: z.record(z.string(), z.unknown()),
    issueType: issueTypeSchema,
    severity: issueSeveritySchema,
    confidence: z.number().min(0).max(1),
    rationale: z.string().min(1),
    currentText: z.string(),
    status: changeStatusSchema,
    ruleId: z.string().optional(),
    termId: z.string().optional(),
    evidence: findingEvidenceSchema.optional(),
    source: findingSourceSchema.optional()
  })
  .refine((v) => !(v.ruleId !== undefined && v.termId !== undefined), {
    message: "ruleId and termId are mutually exclusive"
  });

export const uxCopyFindingListSchema = z.object({
  findings: z.array(uxCopyFindingSchema)
});

export type IssueSeverity = z.infer<typeof issueSeveritySchema>;
export type IssueType = z.infer<typeof issueTypeSchema>;
export type FindingEvidence = z.infer<typeof findingEvidenceSchema>;
export type FindingSource = z.infer<typeof findingSourceSchema>;
export type UxCopyFinding = z.infer<typeof uxCopyFindingSchema>;
export type UxCopyFindingList = z.infer<typeof uxCopyFindingListSchema>;

export function parseUxCopyFinding(payload: unknown): UxCopyFinding {
  return uxCopyFindingSchema.parse(payload);
}
