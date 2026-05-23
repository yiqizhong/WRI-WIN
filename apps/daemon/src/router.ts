import type { IncomingMessage, ServerResponse } from "node:http";

import { apiErrorSchema } from "@writer/contracts";

import type { DaemonConfig } from "./config";
import { getBootstrapCapabilities } from "./capabilities";
import { handleHealthRequest } from "./routes/health";

export function createRequestHandler(config: DaemonConfig) {
  return (request: IncomingMessage, response: ServerResponse) => {
    if (
      handleHealthRequest(request, response, {
        config,
        getCapabilitySummary: getBootstrapCapabilities
      })
    ) {
      return;
    }

    const payload = apiErrorSchema.parse({
      code: "not_found",
      message: "Route not found.",
      guidance: "Check the daemon API path or update the desktop client."
    });

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  };
}
