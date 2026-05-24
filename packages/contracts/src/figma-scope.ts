import { z } from "zod";

export const figmaScopeKindSchema = z.literal("frame");

export const figmaReviewScopeSchema = z.object({
  kind: z.literal("frame"),
  fileKey: z.string().min(1),
  nodeId: z.string().min(1),
  frameName: z.string().optional()
});

export const parseFigmaUrlInputSchema = z.object({
  url: z.string().url()
});

export const parsedFigmaUrlSchema = z.object({
  fileKey: z.string().min(1),
  nodeId: z.string().min(1),
  suggestedScope: figmaReviewScopeSchema
});

export type FigmaScopeKind = z.infer<typeof figmaScopeKindSchema>;
export type FigmaReviewScope = z.infer<typeof figmaReviewScopeSchema>;
export type ParsedFigmaUrl = z.infer<typeof parsedFigmaUrlSchema>;

export function parseFigmaReviewScope(payload: unknown): FigmaReviewScope {
  return figmaReviewScopeSchema.parse(payload);
}

export function parseParsedFigmaUrl(payload: unknown): ParsedFigmaUrl {
  return parsedFigmaUrlSchema.parse(payload);
}
