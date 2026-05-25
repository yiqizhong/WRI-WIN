import type { IncomingMessage, ServerResponse } from "node:http";

import type { DaemonHealth } from "@writer/contracts";

import type { DaemonConfig } from "../config";

export type HealthHandlerDeps = {
  config: DaemonConfig;
  getCapabilitySummary: () => DaemonHealth["capabilities"];
};

export function handleHealthRequest(
  request: IncomingMessage,
  response: ServerResponse,
  deps: HealthHandlerDeps
): boolean {
  if (request.method !== "GET" || request.url !== "/health") {
    return false;
  }

  const capabilities = deps.getCapabilitySummary();
  const hasDegraded = capabilities.some((capability) => capability.status === "degraded");

  const payload: DaemonHealth = {
    status: hasDegraded ? "degraded" : "running",
    version: deps.config.version,
    apiRevision: deps.config.apiRevision,
    capabilities
  };

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
  return true;
}
