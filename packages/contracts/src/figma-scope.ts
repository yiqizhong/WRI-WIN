import { z } from "zod";

export const figmaScopeKindSchema = z.enum(["file", "frame", "flow"]);

export const figmaReviewScopeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("file"),
    fileKey: z.string().min(1),
    fileName: z.string().optional()
  }),
  z.object({
    kind: z.literal("frame"),
    fileKey: z.string().min(1),
    nodeId: z.string().min(1),
    frameName: z.string().optional()
  }),
  z.object({
    kind: z.literal("flow"),
    fileKey: z.string().min(1),
    nodeIds: z.array(z.string().min(1)).min(1),
    flowName: z.string().optional()
  })
]);

export const parseFigmaUrlInputSchema = z.object({
  url: z.string().url()
});

export const parsedFigmaUrlSchema = z.object({
  fileKey: z.string().min(1),
  nodeId: z.string().min(1).optional(),
  frameName: z.string().optional(),
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
