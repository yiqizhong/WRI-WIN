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

export const guidelineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  layer: guidelineLayerSchema.optional(),
  productId: z.string().min(1).optional(),
  parentId: z.string().optional(),
  /** Prose or full markdown file text for LLM consumption. */
  body: z.string().optional(),
  schema: z.number().int().positive().optional(),
  version: z.string().min(1).optional(),
  updatedAt: z.string().optional(),
  rules: z.array(ruleSchema).default([]),
  glossary: z.array(termSchema).default([])
});

/** Freeform product background — full file text for LLM; no required frontmatter fields. */
export const productBackgroundSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  content: z.string(),
  /** @deprecated prose-only slice; prefer `content` */
  body: z.string().optional(),
  audience: z.string().optional(),
  environment: z.string().optional(),
  purpose: z.string().optional()
});

export const productExtraFileSchema = z.object({
  filename: z.string().min(1),
  content: z.string()
});

export const productPackageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  background: productBackgroundSchema.optional(),
  /** Parsed terms when present; optional — LLM may use glossaryContent instead. */
  glossary: z.array(termSchema).default([]),
  glossaryContent: z.string().optional(),
  glossaryFormat: z.enum(["csv", "md"]).optional(),
  writingGuide: guidelineSchema.optional(),
  /** Raw writing-guide.md text for LLM when structured parse is not used. */
  writingGuideContent: z.string().optional(),
  extraFiles: z.array(productExtraFileSchema).default([])
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
  /** Label shown in UI — original upload name when known, else canonical on-disk basename. */
  backgroundFilename: z.string().min(1).optional(),
  glossaryFilename: z.string().min(1).optional(),
  writingGuideFilename: z.string().min(1).optional(),
  extraFileCount: z.number().int().nonnegative().default(0),
  parseStatus: z.enum(["ok", "error", "incomplete"]),
  parseError: parseErrorSchema.optional()
});

export const guidelinesTreeSchema = z.object({
  companyBase: guidelineSchema.nullable(),
  softwareWriting: guidelineSchema.nullable(),
  /** User-facing label from last upload (not necessarily the on-disk canonical name). */
  companyBaseFilename: z.string().min(1).optional(),
  softwareWritingFilename: z.string().min(1).optional(),
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
export type ProductExtraFile = z.infer<typeof productExtraFileSchema>;
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

function isLegacyGuidelinesListPayload(
  payload: unknown
): payload is GuidelineList & Record<string, unknown> {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return Array.isArray(p.guidelines) && !("products" in p);
}

export function parseGuidelinesTree(payload: unknown): GuidelinesTree {
  if (isLegacyGuidelinesListPayload(payload)) {
    return guidelinesTreeSchema.parse({
      companyBase: null,
      softwareWriting: null,
      products: [],
      companyBaseMissing: payload.companyMissing,
      softwareWritingMissing: true
    });
  }
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

export function isLegacyGuidelineSnapshot(
  snapshot: SessionGuidelineSnapshot
): snapshot is GuidelineSnapshot {
  return "guidelineId" in snapshot;
}
