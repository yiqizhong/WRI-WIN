import { z } from "zod";

export const surfaceSchema = z.enum([
  "button",
  "error",
  "empty-state",
  "toast",
  "body",
  "title",
  "other"
]);

export const guidelineSeveritySchema = z.enum(["must", "should", "may"]);

export const ruleSchema = z.object({
  id: z.string().min(1),
  do: z.string().min(1),
  dont: z.string().optional(),
  reason: z.string().optional(),
  surfaces: z.array(surfaceSchema),
  severity: guidelineSeveritySchema,
  inheritedFrom: z.string().optional(),
  overrides: z.string().optional(),
  excludes: z.string().optional()
});

export const termSchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  status: z.enum(["active", "deprecated"]),
  forbidden: z.array(z.string()).optional(),
  forbiddenReplacement: z.string().optional(),
  caseSensitive: z.boolean(),
  context: z.string().optional(),
  reason: z.string().optional(),
  localizations: z.record(z.string(), z.unknown()).optional()
});

export const guidelineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scope: z.enum(["company", "product"]),
  parentId: z.string().optional(),
  schema: z.number().int().positive(),
  version: z.string().min(1),
  updatedAt: z.iso.datetime(),
  rules: z.array(ruleSchema),
  glossary: z.array(termSchema)
});

export const guidelineListItemSchema = z.object({
  id: z.string().min(1),
  scope: z.enum(["company", "product"]),
  version: z.string().min(1),
  ruleCount: z.number().int().nonnegative(),
  termCount: z.number().int().nonnegative(),
  parseStatus: z.enum(["ok", "error"]),
  parseError: z
    .object({
      file: z.string().min(1),
      line: z.number().int().positive().optional(),
      message: z.string().min(1)
    })
    .optional()
});

export const guidelineListSchema = z.object({
  guidelines: z.array(guidelineListItemSchema),
  companyMissing: z.boolean()
});

export const guidelineSnapshotSchema = z.object({
  guidelineId: z.string().min(1),
  guideline: guidelineSchema,
  contentHashes: z.record(z.string(), z.string()),
  capturedAt: z.iso.datetime()
});

export type Surface = z.infer<typeof surfaceSchema>;
export type GuidelineSeverity = z.infer<typeof guidelineSeveritySchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type Term = z.infer<typeof termSchema>;
export type Guideline = z.infer<typeof guidelineSchema>;
export type GuidelineListItem = z.infer<typeof guidelineListItemSchema>;
export type GuidelineList = z.infer<typeof guidelineListSchema>;
export type GuidelineSnapshot = z.infer<typeof guidelineSnapshotSchema>;

export function parseGuideline(payload: unknown): Guideline {
  return guidelineSchema.parse(payload);
}

export function parseGuidelineList(payload: unknown): GuidelineList {
  return guidelineListSchema.parse(payload);
}

export function parseGuidelineSnapshot(payload: unknown): GuidelineSnapshot {
  return guidelineSnapshotSchema.parse(payload);
}
