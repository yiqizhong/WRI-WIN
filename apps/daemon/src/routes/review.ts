import type { IncomingMessage, ServerResponse } from "node:http";

import { getQueryParam, readJsonBody } from "../http";
import { FigmaUrlParseError } from "@writer/review-core";

import {
  assembleSessionContext,
  buildReportArtifact,
  createPastedTextSession,
  extractFigmaNodes,
  listReviewChanges,
  parseFigmaUrlInput,
  transitionReviewChange
} from "../review";
import type { DaemonState } from "../state";
import { invalidRequest, notFound } from "../errors";

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

export async function handleReviewRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: DaemonState
): Promise<boolean> {
  const path = request.url?.split("?")[0];

  if (request.method === "POST" && path === "/figma/parse-url") {
    try {
      sendJson(response, 200, parseFigmaUrlInput(await readJsonBody(request)));
    } catch (error) {
      if (error instanceof FigmaUrlParseError) {
        invalidRequest(response, error.message, "Use a figma.com/design/... URL.");
        return true;
      }

      invalidRequest(response, "Invalid Figma URL payload.", "Provide url.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/figma/extract") {
    try {
      sendJson(response, 200, extractFigmaNodes(await readJsonBody(request)));
    } catch {
      invalidRequest(response, "Invalid Figma extract payload.", "Provide scope.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/sessions/pasted-text") {
    try {
      const session = await createPastedTextSession(state, await readJsonBody(request));
      sendJson(response, 201, session);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Session")) {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Invalid pasted text payload.", "Provide projectId and text.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/review/context") {
    try {
      sendJson(response, 200, assembleSessionContext(state, await readJsonBody(request)));
    } catch (error) {
      if (error instanceof Error && error.message === "Session not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Invalid context payload.", "Provide sessionId.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/review/changes/transition") {
    try {
      const change = await transitionReviewChange(state, await readJsonBody(request));
      sendJson(response, 200, change);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Review change not found") {
          notFound(response, error.message);
          return true;
        }

        if (error.name === "InvalidChangeTransitionError") {
          invalidRequest(response, error.message);
          return true;
        }
      }

      invalidRequest(response, "Invalid change transition payload.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/review/changes") {
    const sessionId = getQueryParam(request.url, "sessionId");
    sendJson(response, 200, listReviewChanges(state, sessionId));
    return true;
  }

  if (request.method === "GET" && path?.startsWith("/review/reports/")) {
    const sessionId = path.split("/").pop();

    if (!sessionId) {
      invalidRequest(response, "Missing session id.");
      return true;
    }

    try {
      sendJson(response, 200, buildReportArtifact(state, sessionId));
    } catch (error) {
      if (error instanceof Error && error.message === "Session not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Unable to build report.");
    }
    return true;
  }

  return false;
}
