import type { IncomingMessage, ServerResponse } from "node:http";

import type { DaemonConfig } from "./config";
import { getBootstrapCapabilities } from "./capabilities";
import { invalidRequest, notFound } from "./errors";
import { handleHealthRequest } from "./routes/health";
import { handleFilesystemRequest } from "./routes/filesystem";
import { handlePlatformRequest } from "./routes/platform";
import { handleReviewRequest } from "./routes/review";
import { createDaemonState, type DaemonState } from "./state";

export function createRequestHandler(config: DaemonConfig, state: DaemonState) {
  return (request: IncomingMessage, response: ServerResponse) => {
    void routeRequest(request, response, config, state);
  };
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: DaemonConfig,
  state: DaemonState
) {
  if (request.method !== "GET" && request.method !== "POST" && request.method !== "DELETE") {
    invalidRequest(
      response,
      `Method ${request.method ?? "UNKNOWN"} is not supported.`,
      "Use GET, POST, or DELETE for daemon APIs."
    );
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

  if (await handleFilesystemRequest(request, response)) {
    return;
  }

  if (await handlePlatformRequest(request, response, state)) {
    return;
  }

  if (await handleReviewRequest(request, response, state)) {
    return;
  }

  notFound(
    response,
    "Route not found.",
    "Check the daemon API path or update the desktop client."
  );
}
