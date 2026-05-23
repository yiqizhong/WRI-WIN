import type { IncomingMessage, ServerResponse } from "node:http";

import { getQueryParam, readJsonBody } from "../http";
import {
  createProject,
  createSession,
  decidePermission,
  getAgentAdapterList,
  getMcpServerList,
  getToolList,
  listPermissionRequests,
  listProjects,
  listSessions,
  type DaemonState
} from "../state";
import { invalidRequest, notFound, serviceUnavailable } from "../errors";

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

export async function handlePlatformRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: DaemonState
): Promise<boolean> {
  const path = request.url?.split("?")[0];

  if (request.method === "GET" && path === "/projects") {
    sendJson(response, 200, listProjects(state));
    return true;
  }

  if (request.method === "POST" && path === "/projects") {
    try {
      const project = await createProject(state, await readJsonBody(request));
      sendJson(response, 201, project);
    } catch {
      invalidRequest(response, "Invalid project payload.", "Provide name and rootPath.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/sessions") {
    const projectId = getQueryParam(request.url, "projectId");
    sendJson(response, 200, listSessions(state, projectId));
    return true;
  }

  if (request.method === "POST" && path === "/sessions") {
    try {
      const session = await createSession(state, await readJsonBody(request));
      sendJson(response, 201, session);
    } catch {
      invalidRequest(response, "Invalid session payload.", "Provide projectId and sourceType.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/agents") {
    sendJson(response, 200, getAgentAdapterList());
    return true;
  }

  if (request.method === "GET" && path === "/tools") {
    sendJson(response, 200, getToolList());
    return true;
  }

  if (request.method === "GET" && path === "/mcp/servers") {
    sendJson(response, 200, getMcpServerList());
    return true;
  }

  if (request.method === "GET" && path === "/permissions/requests") {
    sendJson(response, 200, { requests: listPermissionRequests(state) });
    return true;
  }

  if (request.method === "POST" && path === "/permissions/decisions") {
    try {
      const decision = await decidePermission(state, await readJsonBody(request));
      sendJson(response, 200, decision);
    } catch (error) {
      if (error instanceof Error && error.message === "Permission request not found") {
        notFound(response, "Permission request not found.");
        return true;
      }

      invalidRequest(response, "Invalid permission decision payload.", "Provide requestId and decision.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/agents/missing-cli") {
    serviceUnavailable(
      response,
      "Requested agent CLI is not installed.",
      "Install the agent CLI or choose another adapter in Settings."
    );
    return true;
  }

  return false;
}
