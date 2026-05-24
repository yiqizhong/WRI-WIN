import { z } from "zod";

import { productPackageListItemSchema } from "./guideline";

export const workspaceInfoSchema = z.object({
  projectId: z.string().min(1),
  lastProductId: z.string().min(1).nullable(),
  products: z.array(productPackageListItemSchema)
});

export type WorkspaceInfo = z.infer<typeof workspaceInfoSchema>;

export function parseWorkspaceInfo(payload: unknown): WorkspaceInfo {
  return workspaceInfoSchema.parse(payload);
}
