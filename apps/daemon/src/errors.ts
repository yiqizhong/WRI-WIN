import type { ServerResponse } from "node:http";

import { type ApiError, type ApiErrorCode, apiErrorSchema } from "@writer/contracts";

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  not_found: 404,
  conflict: 409,
  service_unavailable: 503,
  permission_denied: 403,
  agent_unavailable: 503,
  tool_unavailable: 503,
  mcp_unavailable: 503,
  internal_error: 500
};

export type ApiErrorInput = {
  code: ApiErrorCode;
  message: string;
  guidance?: string;
  details?: Record<string, unknown>;
};

export function toApiError(input: ApiErrorInput): ApiError {
  return apiErrorSchema.parse(input);
}

export function sendApiError(response: ServerResponse, input: ApiErrorInput): void {
  const error = toApiError(input);
  response.writeHead(ERROR_STATUS[error.code], { "content-type": "application/json" });
  response.end(JSON.stringify(error));
}

export function invalidRequest(
  response: ServerResponse,
  message: string,
  guidance?: string,
  details?: Record<string, unknown>
): void {
  sendApiError(response, { code: "invalid_request", message, guidance, details });
}

export function notFound(response: ServerResponse, message: string, guidance?: string): void {
  sendApiError(response, { code: "not_found", message, guidance });
}

export function serviceUnavailable(
  response: ServerResponse,
  message: string,
  guidance?: string
): void {
  sendApiError(response, { code: "service_unavailable", message, guidance });
}

export function permissionDenied(
  response: ServerResponse,
  message: string,
  guidance?: string
): void {
  sendApiError(response, { code: "permission_denied", message, guidance });
}
