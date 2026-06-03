import { z } from "zod";

import { productPackageListItemSchema } from "./guideline";

export const userProfileSchema = z.object({
  name: z.string().min(1)
});

export const workspaceInfoSchema = z.object({
  projectId: z.string().min(1),
  lastProductId: z.string().min(1).nullable(),
  products: z.array(productPackageListItemSchema),
  userProfile: userProfileSchema.nullable()
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type WorkspaceInfo = z.infer<typeof workspaceInfoSchema>;

export function parseWorkspaceInfo(payload: unknown): WorkspaceInfo {
  return workspaceInfoSchema.parse(payload);
}
