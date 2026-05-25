import type { IncomingMessage, ServerResponse } from "node:http";

import { getQueryParam, readJsonBody } from "../http";
import {
  cancelAgentRun,
  createPermissionRequest,
  createProject,
  createSession,
  decidePermission,
  executeTool,
  getAgentAdapterList,
  refreshAgentDetection,
  smokeAgentAdapter,
  getAgentRunDetail,
  getMcpServerList,
  getToolList,
  listPermissionRequests,
  listProjects,
  listSessions,
  setActiveAdapter,
  setMcpServerEnabled,
  smokeFigmaRead,
  smokeFigmaWrite,
  startFigmaMcpAuth,
  startAgentRun,
  type DaemonState
} from "../state";
import { invalidRequest, notFound, permissionDenied, serviceUnavailable } from "../errors";
import { getWorkspaceInfo } from "../workspace";

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function getPathSegments(path: string | undefined): string[] {
  return (path ?? "").split("/").filter(Boolean);
}

export async function handlePlatformRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: DaemonState
): Promise<boolean> {
  const url = request.url ?? "";
  const path = url.split("?")[0];
  const segments = getPathSegments(path);

  if (request.method === "GET" && path === "/workspace") {
    try {
      sendJson(response, 200, await getWorkspaceInfo(state));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load workspace.";
      invalidRequest(response, message);
    }
    return true;
  }

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
    const projectId = getQueryParam(url, "projectId");
    sendJson(response, 200, listSessions(state, projectId));
    return true;
  }

  const sessionMatch = path.match(/^\/sessions\/([^/]+)$/);
  if (sessionMatch && request.method === "GET") {
    const sessionId = decodeURIComponent(sessionMatch[1]!);
    const sessions = state.store.listSessions(null);
    const session = sessions.sessions.find((item) => item.id === sessionId);

    if (!session) {
      notFound(response, "Session not found.");
      return true;
    }

    sendJson(response, 200, session);
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
    sendJson(response, 200, await getAgentAdapterList(state));
    return true;
  }

  if (request.method === "POST" && path === "/agents/detect") {
    sendJson(response, 200, await refreshAgentDetection(state));
    return true;
  }

  if (request.method === "POST" && path === "/agents/smoke") {
    try {
      sendJson(response, 200, await smokeAgentAdapter(state, await readJsonBody(request)));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unknown")) {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Invalid smoke payload.", "Provide adapterId.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/agents/active") {
    try {
      sendJson(response, 200, await setActiveAdapter(state, await readJsonBody(request)));
    } catch {
      invalidRequest(response, "Invalid active adapter payload.", "Provide adapterId.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/agents/runs") {
    try {
      const result = await startAgentRun(state, await readJsonBody(request));
      sendJson(response, 201, result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Session not found") {
          notFound(response, error.message);
          return true;
        }

        if (error.message.startsWith("Agent adapter unavailable")) {
          serviceUnavailable(
            response,
            error.message,
            "Install the agent CLI or choose another adapter in Settings."
          );
          return true;
        }
      }

      invalidRequest(response, "Invalid agent run payload.", "Provide sessionId and prompt.");
    }
    return true;
  }

  if (request.method === "GET" && segments[0] === "agents" && segments[1] === "runs" && segments[2]) {
    const detail = getAgentRunDetail(state, segments[2]);

    if (!detail) {
      notFound(response, "Agent run not found.");
      return true;
    }

    sendJson(response, 200, detail);
    return true;
  }

  if (request.method === "DELETE" && segments[0] === "agents" && segments[1] === "runs" && segments[2]) {
    try {
      const run = await cancelAgentRun(state, segments[2]);
      sendJson(response, 200, run);
    } catch (error) {
      if (error instanceof Error && error.message === "Agent run not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Unable to cancel agent run.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/tools") {
    sendJson(response, 200, getToolList());
    return true;
  }

  if (request.method === "POST" && path === "/tools/execute") {
    try {
      const result = await executeTool(state, await readJsonBody(request));

      if (!result.ok) {
        permissionDenied(
          response,
          "Tool execution requires approval.",
          `Approve permission request ${result.permissionRequestId ?? "unknown"}.`
        );
        return true;
      }

      sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof Error && error.message === "Tool not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Invalid tool execution payload.", "Provide toolId.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/mcp/servers") {
    sendJson(response, 200, getMcpServerList(state));
    return true;
  }

  if (request.method === "POST" && path === "/mcp/servers/figma/auth/start") {
    sendJson(response, 200, await startFigmaMcpAuth(state));
    return true;
  }

  if (request.method === "POST" && segments[0] === "mcp" && segments[1] === "servers" && segments[2]) {
    try {
      const server = await setMcpServerEnabled(state, segments[2], await readJsonBody(request));
      sendJson(response, 200, server);
    } catch (error) {
      if (error instanceof Error && error.message === "Unknown MCP server") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Invalid MCP server payload.", "Provide enabled boolean.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/mcp/smoke/figma/read") {
    sendJson(response, 200, await smokeFigmaRead(state));
    return true;
  }

  if (request.method === "POST" && path === "/mcp/smoke/figma/write") {
    try {
      const body = (await readJsonBody(request)) as {
        sessionId?: string;
        permissionRequestId?: string;
        changeId?: string;
      };

      if (!body.sessionId) {
        invalidRequest(response, "Missing sessionId for Figma write smoke.");
        return true;
      }

      const result = await smokeFigmaWrite(state, {
        sessionId: body.sessionId,
        permissionRequestId: body.permissionRequestId,
        changeId: body.changeId
      });

      if (!result.ok) {
        permissionDenied(
          response,
          "Figma write smoke requires approval.",
          `Approve permission request ${result.permissionRequestId ?? "unknown"}.`
        );
        return true;
      }

      sendJson(response, 200, result);
    } catch {
      invalidRequest(response, "Invalid Figma write smoke payload.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/permissions/requests") {
    sendJson(response, 200, { requests: listPermissionRequests(state) });
    return true;
  }

  if (request.method === "POST" && path === "/permissions/requests") {
    try {
      const created = await createPermissionRequest(state, await readJsonBody(request));
      sendJson(response, 201, created);
    } catch (error) {
      if (error instanceof Error && error.message === "Tool not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Invalid permission request payload.", "Provide toolId, sessionId, and reason.");
    }
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

  if (
    request.method === "PATCH" &&
    segments[0] === "projects" &&
    segments[1] &&
    (segments[2] === "product" || segments[2] === "guideline")
  ) {
    const projectId = segments[1];
    const body = (await readJsonBody(request)) as {
      productId?: string | null;
      guidelineId?: string | null;
    };
    const productId = body.productId ?? body.guidelineId ?? null;
    state.store.setActiveProductId(projectId, productId);
    await state.store.save();
    const projects = listProjects(state);
    const project = projects.projects.find((p) => p.id === projectId);
    if (!project) {
      notFound(response, "Project not found.");
      return true;
    }
    sendJson(response, 200, project);
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
