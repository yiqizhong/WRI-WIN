import { z } from "zod";

export const figmaAuditModeSchema = z.enum(["single_frame", "workflow"]);

export const frameBoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
});

export const pageFrameListItemSchema = z.object({
  nodeId: z.string().min(1),
  name: z.string().min(1),
  parentPath: z.string(),
  boundingBox: frameBoundingBoxSchema
});

export const listPageFramesRequestSchema = z.object({
  pageUrl: z.string().url()
});

export const flowDirectionSchema = z.enum(["horizontal", "vertical", "grid"]);

export const listPageFramesResponseSchema = z.object({
  frames: z.array(pageFrameListItemSchema),
  detectedDirection: flowDirectionSchema
});

export const frameScreenshotSchema = z.object({
  frameId: z.string().min(1),
  fileRef: z.string().min(1)
});

export const writebackReportFailedItemSchema = z.object({
  nodeId: z.string().min(1),
  errorCode: z.string().min(1),
  errorMessage: z.string().min(1)
});

export const sessionWritebackReportSchema = z.object({
  attemptedAt: z.iso.datetime(),
  written: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.array(writebackReportFailedItemSchema)
});

const figmaSessionBaseSchema = z.object({
  projectId: z.string().min(1),
  productId: z.string().min(1).optional(),
  featureName: z.string().min(1),
  description: z.string().min(1)
});

export const createFigmaSessionInputSchema = z.discriminatedUnion("mode", [
  figmaSessionBaseSchema.extend({
    mode: z.literal("single_frame"),
    url: z.string().url()
  }),
  figmaSessionBaseSchema.extend({
    mode: z.literal("workflow"),
    fileKey: z.string().min(1),
    nodeIds: z.array(z.string().min(1)).min(1),
    flowName: z.string().optional(),
    nodeNames: z.record(z.string().min(1), z.string().min(1)).optional()
  })
]);

export type FigmaAuditMode = z.infer<typeof figmaAuditModeSchema>;
export type FrameBoundingBox = z.infer<typeof frameBoundingBoxSchema>;
export type PageFrameListItem = z.infer<typeof pageFrameListItemSchema>;
export type FlowDirection = z.infer<typeof flowDirectionSchema>;
export type ListPageFramesRequest = z.infer<typeof listPageFramesRequestSchema>;
export type ListPageFramesResponse = z.infer<typeof listPageFramesResponseSchema>;
export type FrameScreenshot = z.infer<typeof frameScreenshotSchema>;
export type WritebackReportFailedItem = z.infer<typeof writebackReportFailedItemSchema>;
export type SessionWritebackReport = z.infer<typeof sessionWritebackReportSchema>;
export type CreateFigmaSessionInput = z.infer<typeof createFigmaSessionInputSchema>;

export function parseListPageFramesRequest(payload: unknown): ListPageFramesRequest {
  return listPageFramesRequestSchema.parse(payload);
}

export function parseListPageFramesResponse(payload: unknown): ListPageFramesResponse {
  return listPageFramesResponseSchema.parse(payload);
}

export function parseCreateFigmaSessionInput(payload: unknown): CreateFigmaSessionInput {
  return createFigmaSessionInputSchema.parse(payload);
}
