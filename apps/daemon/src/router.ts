import type { IncomingMessage, ServerResponse } from "node:http";

import type { DaemonConfig } from "./config";
import { getDaemonCapabilities } from "./capabilities";
import { invalidRequest, notFound } from "./errors";
import { handleHealthRequest } from "./routes/health";
import { handleFilesystemRequest } from "./routes/filesystem";
import { handlePlatformRequest } from "./routes/platform";
import { handleReviewRequest } from "./routes/review";
import { createDaemonState, type DaemonState } from "./state";

function applyDevCors(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "content-type");
}

export function createRequestHandler(config: DaemonConfig, state: DaemonState) {
  return (request: IncomingMessage, response: ServerResponse) => {
    applyDevCors(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    void routeRequest(request, response, config, state);
  };
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: DaemonConfig,
  state: DaemonState
) {
  if (
    request.method !== "GET" &&
    request.method !== "POST" &&
    request.method !== "DELETE" &&
    request.method !== "PATCH" &&
    request.method !== "PUT" &&
    request.method !== "OPTIONS"
  ) {
    invalidRequest(
      response,
      `Method ${request.method ?? "UNKNOWN"} is not supported.`,
      "Use GET, POST, PUT, PATCH, or DELETE for daemon APIs."
    );
    return;
  }

  if (
    handleHealthRequest(request, response, {
      config,
      getCapabilitySummary: () => getDaemonCapabilities(state)
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
