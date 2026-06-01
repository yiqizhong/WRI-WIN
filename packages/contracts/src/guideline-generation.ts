import { z } from "zod";

import { connectionDiagnosticSchema } from "./connection-diagnostic";

export const guidelineCandidateCategorySchema = z.enum([
  "headline",
  "body",
  "cta",
  "label",
  "navigation",
  "form",
  "other"
]);

export const guidelineCandidateSampleSchema = z.object({
  sampleId: z.string().min(1),
  nodeId: z.string().min(1),
  text: z.string().min(1),
  normalizedText: z.string().min(1),
  category: guidelineCandidateCategorySchema,
  framePath: z.string().min(1),
  pageName: z.string().min(1).optional(),
  frameName: z.string().min(1).optional(),
  nodeName: z.string().min(1).optional(),
  occurrenceCount: z.number().int().positive().default(1)
});

export const candidateCategoryDistributionSchema = z.record(
  guidelineCandidateCategorySchema,
  z.number().int().nonnegative()
);

export const guidelineCoverageMetadataSchema = z.object({
  pageCount: z.number().int().nonnegative(),
  frameCount: z.number().int().nonnegative(),
  uniquePages: z.array(z.string().min(1)),
  uniqueFrames: z.array(z.string().min(1))
});

export const guidelineCandidatePackageSchema = z.object({
  maxCandidates: z.number().int().positive().default(500),
  totalCandidates: z.number().int().nonnegative(),
  selectedCandidates: z.number().int().nonnegative(),
  categoryDistribution: candidateCategoryDistributionSchema,
  coverageMetadata: guidelineCoverageMetadataSchema,
  samples: z.array(guidelineCandidateSampleSchema)
});

export const semanticDuplicateGroupSchema = z.object({
  canonicalSampleId: z.string().min(1),
  duplicateSampleIds: z.array(z.string().min(1))
});

export const semanticObservationSchema = z.object({
  category: z.string().min(1),
  note: z.string().min(1),
  confidence: z.number().min(0).max(1)
});

export const selectedEvidenceSchema = z.object({
  sampleId: z.string().min(1),
  reason: z.string().min(1)
});

export const degradedPathStageSchema = z.enum([
  "candidate_package",
  "semantic_analysis",
  "final_generation"
]);

export const degradedPathSchema = z.object({
  stage: degradedPathStageSchema,
  reason: z.string().min(1),
  limitations: z.array(z.string().min(1)).default([])
});

export const semanticAnalysisStatusSchema = z.enum(["applied", "fallback", "failed", "skipped"]);

export const semanticAnalysisSchema = z.object({
  selectedSampleIds: z.array(z.string().min(1)),
  duplicateGroups: z.array(semanticDuplicateGroupSchema),
  terminology: z.array(z.string().min(1)),
  observations: z.array(semanticObservationSchema),
  selectedEvidence: z.array(selectedEvidenceSchema),
  coverageGaps: z.array(z.string().min(1)),
  confidenceNotes: z.array(z.string().min(1)),
  status: semanticAnalysisStatusSchema.default("applied"),
  degradedPath: degradedPathSchema.optional()
});

export const generationSummarySchema = z.object({
  candidateCount: z.number().int().nonnegative(),
  selectedCount: z.number().int().nonnegative(),
  categoryDistribution: candidateCategoryDistributionSchema,
  semanticAnalysisStatus: semanticAnalysisStatusSchema,
  confidence: z.string().min(1),
  limitations: z.array(z.string().min(1)).default([])
});

export const figmaGuidelineGlossaryEntrySchema = z.object({
  term: z.string().min(1),
  definition: z.string().default(""),
  preferred: z.string().default(""),
  avoid: z.string().default(""),
  usageContext: z.string().default(""),
  example: z.string().default("")
});

export const figmaGuidelineDraftSchema = z.object({
  productContext: z.string().default(""),
  audience: z.string().default(""),
  voice: z.array(z.string()).default([]),
  toneBySituation: z
    .array(z.object({ situation: z.string(), tone: z.string() }))
    .default([]),
  desiredUserFeeling: z.array(z.string()).default([]),
  glossary: z.array(figmaGuidelineGlossaryEntrySchema).default([]),
  writingPrinciples: z.array(z.string()).default([]),
  uiScenarioRules: z
    .array(z.object({ scenario: z.string(), guidance: z.string() }))
    .default([]),
  styleConventions: z.array(z.string()).default([]),
  accessibilityAndLocalizationNotes: z.array(z.string()).default([]),
  doDontExamples: z
    .array(z.object({ do: z.string(), dont: z.string(), reason: z.string() }))
    .default([])
});

export const figmaGuidelineGeneratedFileNameSchema = z.enum([
  "background.md",
  "glossary.csv",
  "writing-guide.md",
  "generation-summary.md"
]);

export const figmaGuidelineGeneratedFileSchema = z.object({
  name: figmaGuidelineGeneratedFileNameSchema,
  mimeType: z.enum(["text/markdown", "text/csv"]),
  content: z.string()
});

export const figmaGuidelineStarterPackSummarySchema = z.object({
  sourceLabel: z.string().min(1),
  scopeLabel: z.string().min(1),
  pageCount: z.number().int().nonnegative(),
  frameCount: z.number().int().nonnegative(),
  textSampleCount: z.number().int().nonnegative(),
  candidateCount: z.number().int().nonnegative(),
  selectedCount: z.number().int().nonnegative(),
  categoryDistribution: candidateCategoryDistributionSchema,
  semanticAnalysisStatus: semanticAnalysisStatusSchema,
  confidenceNotes: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([])
});

export const figmaGuidelineGenerationRequestSchema = z.object({
  sessionId: z.string().min(1),
  adapterId: z.string().min(1).optional(),
  maxCandidates: z.number().int().positive().max(500).default(500)
});

export const figmaGuidelineGenerationResponseSchema = z.object({
  ok: z.boolean(),
  sessionId: z.string().min(1),
  candidatePackage: guidelineCandidatePackageSchema.optional(),
  semanticAnalysis: semanticAnalysisSchema.optional(),
  generationSummary: generationSummarySchema.optional(),
  files: z.array(figmaGuidelineGeneratedFileSchema).length(4).optional(),
  diagnostic: connectionDiagnosticSchema.optional(),
  diagnostics: z.array(z.string().min(1)).default([])
});

export type GuidelineCandidateCategory = z.infer<typeof guidelineCandidateCategorySchema>;
export type GuidelineCandidateSample = z.infer<typeof guidelineCandidateSampleSchema>;
export type GuidelineCoverageMetadata = z.infer<typeof guidelineCoverageMetadataSchema>;
export type GuidelineCandidatePackage = z.infer<typeof guidelineCandidatePackageSchema>;
export type SemanticDuplicateGroup = z.infer<typeof semanticDuplicateGroupSchema>;
export type SemanticObservation = z.infer<typeof semanticObservationSchema>;
export type SelectedEvidence = z.infer<typeof selectedEvidenceSchema>;
export type DegradedPath = z.infer<typeof degradedPathSchema>;
export type SemanticAnalysis = z.infer<typeof semanticAnalysisSchema>;
export type GenerationSummary = z.infer<typeof generationSummarySchema>;
export type FigmaGuidelineGlossaryEntry = z.infer<typeof figmaGuidelineGlossaryEntrySchema>;
export type FigmaGuidelineDraft = z.infer<typeof figmaGuidelineDraftSchema>;
export type FigmaGuidelineGeneratedFile = z.infer<typeof figmaGuidelineGeneratedFileSchema>;
export type FigmaGuidelineStarterPackSummary = z.infer<typeof figmaGuidelineStarterPackSummarySchema>;
export type FigmaGuidelineGenerationRequest = z.infer<typeof figmaGuidelineGenerationRequestSchema>;
export type FigmaGuidelineGenerationResponse = z.infer<typeof figmaGuidelineGenerationResponseSchema>;

export function parseGuidelineCandidatePackage(payload: unknown): GuidelineCandidatePackage {
  return guidelineCandidatePackageSchema.parse(payload);
}

export function parseSemanticAnalysis(payload: unknown): SemanticAnalysis {
  return semanticAnalysisSchema.parse(payload);
}

export function parseGenerationSummary(payload: unknown): GenerationSummary {
  return generationSummarySchema.parse(payload);
}

export function parseFigmaGuidelineDraft(payload: unknown): FigmaGuidelineDraft {
  return figmaGuidelineDraftSchema.parse(payload);
}

export function parseFigmaGuidelineGenerationRequest(payload: unknown): FigmaGuidelineGenerationRequest {
  return figmaGuidelineGenerationRequestSchema.parse(payload);
}

export function parseFigmaGuidelineGenerationResponse(payload: unknown): FigmaGuidelineGenerationResponse {
  return figmaGuidelineGenerationResponseSchema.parse(payload);
}
