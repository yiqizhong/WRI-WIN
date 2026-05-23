import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "invalid_request",
  "not_found",
  "conflict",
  "service_unavailable",
  "permission_denied",
  "agent_unavailable",
  "tool_unavailable",
  "mcp_unavailable",
  "internal_error"
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  guidance: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional()
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

export function parseApiError(payload: unknown): ApiError {
  return apiErrorSchema.parse(payload);
}

export function isApiError(payload: unknown): payload is ApiError {
  return apiErrorSchema.safeParse(payload).success;
}
