import type { IncomingMessage, ServerResponse } from "node:http";

import type { DaemonConfig } from "./config";
import { getBootstrapCapabilities } from "./capabilities";
import { invalidRequest, notFound } from "./errors";
import { handleHealthRequest } from "./routes/health";

export function createRequestHandler(config: DaemonConfig) {
  return (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "GET" && request.method !== "POST") {
      invalidRequest(response, `Method ${request.method ?? "UNKNOWN"} is not supported.`, "Use GET or POST for daemon APIs.");
      return;
    }

    if (
      handleHealthRequest(request, response, {
        config,
        getCapabilitySummary: getBootstrapCapabilities
      })
    ) {
      return;
    }

    notFound(
      response,
      "Route not found.",
      "Check the daemon API path or update the desktop client."
    );
  };
}
