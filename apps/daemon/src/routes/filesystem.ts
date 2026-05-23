import type { IncomingMessage, ServerResponse } from "node:http";

import { listDirectoryInputSchema } from "@writer/contracts";

import { listDirectory } from "../filesystem";
import { invalidRequest, serviceUnavailable } from "../errors";
import { readJsonBody } from "../http";

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

export async function handleFilesystemRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<boolean> {
  const path = request.url?.split("?")[0];

  if (request.method === "POST" && path === "/filesystem/list") {
    try {
      const body = listDirectoryInputSchema.parse(await readJsonBody(request));
      const listing = await listDirectory(body.path);
      sendJson(response, 200, listing);
    } catch (error) {
      if (error instanceof Error && error.message === "Path is not a directory") {
        invalidRequest(response, "Path is not a directory.", "Choose a folder path.");
        return true;
      }

      serviceUnavailable(
        response,
        "Could not read the requested folder.",
        "Check that the path exists and the daemon has permission to read it."
      );
    }
    return true;
  }

  return false;
}
