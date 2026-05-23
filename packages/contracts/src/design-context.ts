import { z } from "zod";

export const designContextNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  parentId: z.string().min(1).optional()
});

export const designContextSchema = z.object({
  fileKey: z.string().min(1),
  focusNodeId: z.string().min(1).optional(),
  hierarchy: z.array(designContextNodeSchema),
  flowOrder: z.array(z.string().min(1)).optional(),
  capturedAt: z.iso.datetime()
});

export type DesignContext = z.infer<typeof designContextSchema>;

export function parseDesignContext(payload: unknown): DesignContext {
  return designContextSchema.parse(payload);
}
