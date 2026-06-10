import type { IncomingMessage, ServerResponse } from "node:http";

import type { DaemonConfig } from "./config";
import { isRequestAuthorized, isHostAllowed, isOriginAllowed } from "./auth";
import { getDaemonCapabilities } from "./capabilities";
import { invalidRequest, notFound } from "./errors";
import { handleHealthRequest } from "./routes/health";
import { handleFilesystemRequest } from "./routes/filesystem";
import { handleGuidelinesRequest } from "./routes/guidelines";
import { handlePlatformRequest } from "./routes/platform";
import { handleReviewRequest } from "./routes/review";
import { createDaemonState, type DaemonState } from "./state";

const DEFAULT_DEV_ORIGIN = "http://127.0.0.1:5173";
const LOCAL_DEV_HOSTS = new Set(["127.0.0.1", "localhost"]);

function resolveDevCorsOrigin(origin: string | string[] | undefined): string {
  const candidate = Array.isArray(origin) ? origin[0] : origin;

  if (!candidate) {
    return DEFAULT_DEV_ORIGIN;
  }

  try {
    const url = new URL(candidate);

    if (url.protocol === "http:" && url.port && LOCAL_DEV_HOSTS.has(url.hostname)) {
      return candidate;
    }
  } catch {
    // Fall back to the default dev origin below.
  }

  return DEFAULT_DEV_ORIGIN;
}

function applyDevCors(request: IncomingMessage, response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", resolveDevCorsOrigin(request.headers.origin));
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
}

export function createRequestHandler(config: DaemonConfig, state: DaemonState) {
  return (request: IncomingMessage, response: ServerResponse) => {
    applyDevCors(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (!isHostAllowed(request.headers.host, config.port) ||
        !isOriginAllowed(request.headers.origin, config.port)) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (!isRequestAuthorized(request.headers, request.url ?? "", config.token)) {
      response.writeHead(401);
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

  if (await handleGuidelinesRequest(request, response)) {
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
