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

export const guidelineLayerSchema = z.enum(["company-base", "software-writing", "product-writing"]);

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

export const guidelineSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    layer: guidelineLayerSchema,
    productId: z.string().min(1).optional(),
    parentId: z.string().optional(),
    body: z.string().optional(),
    schema: z.number().int().positive(),
    version: z.string().min(1),
    updatedAt: z.iso.datetime(),
    rules: z.array(ruleSchema),
    glossary: z.array(termSchema)
  })
  .superRefine((data, ctx) => {
    if (data.layer === "product-writing" && !data.productId) {
      ctx.addIssue({
        code: "custom",
        message: "productId is required when layer is product-writing",
        path: ["productId"]
      });
    }
    if (data.layer !== "product-writing" && data.productId) {
      ctx.addIssue({
        code: "custom",
        message: "productId is only allowed when layer is product-writing",
        path: ["productId"]
      });
    }
  });

export const productBackgroundSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  audience: z.string().min(1),
  environment: z.string().min(1),
  purpose: z.string().min(1),
  body: z.string(),
  schema: z.number().int().positive(),
  version: z.string().min(1),
  updatedAt: z.iso.datetime()
});

export const productPackageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  background: productBackgroundSchema,
  glossary: z.array(termSchema),
  writingGuide: guidelineSchema.optional()
});

export const parseErrorSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().positive().optional(),
  message: z.string().min(1)
});

export const guidelineListItemSchema = z.object({
  id: z.string().min(1),
  layer: guidelineLayerSchema,
  productId: z.string().min(1).optional(),
  version: z.string().min(1),
  ruleCount: z.number().int().nonnegative(),
  termCount: z.number().int().nonnegative(),
  parseStatus: z.enum(["ok", "error"]),
  parseError: parseErrorSchema.optional()
});

/** @deprecated v1 flat list — use guidelinesTreeSchema after WRI-114 */
export const guidelineListSchema = z.object({
  guidelines: z.array(guidelineListItemSchema),
  companyMissing: z.boolean()
});

export const productPackageListItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hasBackground: z.boolean(),
  hasGlossary: z.boolean(),
  hasWritingGuide: z.boolean(),
  parseStatus: z.enum(["ok", "error", "incomplete"]),
  parseError: parseErrorSchema.optional()
});

export const guidelinesTreeSchema = z.object({
  companyBase: guidelineSchema.nullable(),
  softwareWriting: guidelineSchema.nullable(),
  companyGlossary: z.array(termSchema),
  products: z.array(productPackageListItemSchema),
  companyBaseMissing: z.boolean(),
  softwareWritingMissing: z.boolean(),
  conflictError: z.string().optional()
});

/** v1 per-guideline snapshot — retained until review-core migrates (WRI-118) */
export const guidelineSnapshotSchema = z.object({
  guidelineId: z.string().min(1),
  guideline: guidelineSchema,
  contentHashes: z.record(z.string(), z.string()),
  capturedAt: z.iso.datetime()
});

export const threeLayerGuidelineSnapshotSchema = z.object({
  companyBase: guidelineSchema.nullable(),
  softwareWriting: guidelineSchema.nullable(),
  companyGlossary: z.array(termSchema),
  activeProductId: z.string().min(1).optional(),
  productPackage: productPackageSchema.optional(),
  contentHashes: z.record(z.string(), z.string()),
  capturedAt: z.iso.datetime()
});

/** Session snapshot: 3-layer (preferred) or legacy single-guideline v1 */
export const sessionGuidelineSnapshotSchema = z.union([
  threeLayerGuidelineSnapshotSchema,
  guidelineSnapshotSchema
]);

export type Surface = z.infer<typeof surfaceSchema>;
export type GuidelineLayer = z.infer<typeof guidelineLayerSchema>;
export type GuidelineSeverity = z.infer<typeof guidelineSeveritySchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type Term = z.infer<typeof termSchema>;
export type Guideline = z.infer<typeof guidelineSchema>;
export type ProductBackground = z.infer<typeof productBackgroundSchema>;
export type ProductPackage = z.infer<typeof productPackageSchema>;
export type GuidelineListItem = z.infer<typeof guidelineListItemSchema>;
export type GuidelineList = z.infer<typeof guidelineListSchema>;
export type ProductPackageListItem = z.infer<typeof productPackageListItemSchema>;
export type GuidelinesTree = z.infer<typeof guidelinesTreeSchema>;
export type GuidelineSnapshot = z.infer<typeof guidelineSnapshotSchema>;
export type ThreeLayerGuidelineSnapshot = z.infer<typeof threeLayerGuidelineSnapshotSchema>;
export type SessionGuidelineSnapshot = z.infer<typeof sessionGuidelineSnapshotSchema>;

export function parseGuideline(payload: unknown): Guideline {
  return guidelineSchema.parse(payload);
}

export function parseProductBackground(payload: unknown): ProductBackground {
  return productBackgroundSchema.parse(payload);
}

export function parseProductPackage(payload: unknown): ProductPackage {
  return productPackageSchema.parse(payload);
}

export function parseGuidelineList(payload: unknown): GuidelineList {
  return guidelineListSchema.parse(payload);
}

export function parseGuidelinesTree(payload: unknown): GuidelinesTree {
  return guidelinesTreeSchema.parse(payload);
}

export function parseGuidelineSnapshot(payload: unknown): GuidelineSnapshot {
  return guidelineSnapshotSchema.parse(payload);
}

export function parseThreeLayerGuidelineSnapshot(payload: unknown): ThreeLayerGuidelineSnapshot {
  return threeLayerGuidelineSnapshotSchema.parse(payload);
}

export function parseSessionGuidelineSnapshot(payload: unknown): SessionGuidelineSnapshot {
  return sessionGuidelineSnapshotSchema.parse(payload);
}
