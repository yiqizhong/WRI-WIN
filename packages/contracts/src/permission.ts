import { z } from "zod";

import { toolRiskLevelSchema } from "./tool";

export const permissionDecisionSchema = z.enum(["pending", "approved", "denied"]);

export const permissionRequestSchema = z.object({
  id: z.string().min(1),
  toolId: z.string().min(1),
  toolName: z.string().min(1),
  risk: toolRiskLevelSchema,
  sessionId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  reason: z.string().min(1),
  decision: permissionDecisionSchema,
  decidedAt: z.iso.datetime().optional(),
  decidedBy: z.enum(["user", "system"]).optional()
});

export const permissionRequestListSchema = z.object({
  requests: z.array(permissionRequestSchema)
});

export const permissionDecisionInputSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["approved", "denied"])
});

export type PermissionDecision = z.infer<typeof permissionDecisionSchema>;
export type PermissionRequest = z.infer<typeof permissionRequestSchema>;
export type PermissionRequestList = z.infer<typeof permissionRequestListSchema>;
export type PermissionDecisionInput = z.infer<typeof permissionDecisionInputSchema>;

export function parsePermissionRequest(payload: unknown): PermissionRequest {
  return permissionRequestSchema.parse(payload);
}

export function parsePermissionRequestList(payload: unknown): PermissionRequestList {
  return permissionRequestListSchema.parse(payload);
}

export function parsePermissionDecisionInput(payload: unknown): PermissionDecisionInput {
  return permissionDecisionInputSchema.parse(payload);
}
