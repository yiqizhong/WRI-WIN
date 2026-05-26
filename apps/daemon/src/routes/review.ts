import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

import { getQueryParam, readJsonBody } from "../http";
import { FigmaUrlParseError } from "@writer/review-core";
import { listFigmaPageFrames } from "../figma-page-frames";
import { resolveScreenshotPath } from "../figma-screenshots";

import {
  assembleSessionContext,
  buildReportArtifact,
  createFigmaReviewSession,
  createPastedTextSession,
  extractFigmaNodes,
  listReviewChanges,
  parseFigmaUrlInput,
  transitionReviewChange
} from "../review";
import {
  createPasteTextConversation,
  getPasteTextConversation,
  regeneratePasteTextAssistantMessage,
  sendPasteTextMessage,
  attachPasteTextFile
} from "../paste-text";
import { exportSpreadsheetSession, renderReportHtml } from "../export";
import {
  bulkTransitionChanges,
  exportReportJson,
  exportReportMarkdown,
  getSessionChangelog,
  listReviewQueue,
  parseSpreadsheet,
  runFigmaWriteback,
  runSessionAudit,
  updateProjectGuidance
} from "../review-queue";
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

  if (request.method === "POST" && path === "/figma/list-page-frames") {
    try {
      sendJson(response, 200, await listFigmaPageFrames(state, await readJsonBody(request)));
    } catch (error) {
      if (error instanceof FigmaUrlParseError) {
        invalidRequest(response, error.message, "Use a figma.com/design/... page URL.");
        return true;
      }

      const diagnostic = (error as { diagnostic?: { code?: string; message?: string } }).diagnostic;
      if (diagnostic?.code === "mcp_not_ready") {
        sendJson(response, 503, { diagnostic });
        return true;
      }

      invalidRequest(response, "Invalid list-page-frames payload.", "Provide pageUrl.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/figma/extract") {
    try {
      sendJson(response, 200, await extractFigmaNodes(state, await readJsonBody(request)));
    } catch {
      invalidRequest(response, "Invalid Figma extract payload.", "Provide scope.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/sessions/figma") {
    try {
      const session = await createFigmaReviewSession(state, await readJsonBody(request));
      sendJson(response, 201, session);
    } catch (error) {
      if (error instanceof FigmaUrlParseError) {
        invalidRequest(response, error.message, "Use a figma.com/design/... URL.");
        return true;
      }

      if (error instanceof Error && error.message.includes("Unknown productId")) {
        invalidRequest(response, error.message);
        return true;
      }

      invalidRequest(
        response,
        "Invalid Figma session payload.",
        "Provide projectId, featureName, description, mode, and url or workflow nodeIds."
      );
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

      invalidRequest(response, "Invalid pasted text payload.", "Provide projectId, productId, and text.");
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

  if (request.method === "GET" && path === "/review/queue") {
    const sessionId = getQueryParam(request.url, "sessionId");

    if (!sessionId) {
      invalidRequest(response, "Missing sessionId query parameter.");
      return true;
    }

    sendJson(response, 200, listReviewQueue(state, sessionId));
    return true;
  }

  if (request.method === "POST" && path === "/review/audit/run") {
    try {
      sendJson(response, 200, await runSessionAudit(state, await readJsonBody(request)));
    } catch (error) {
      if (error instanceof Error && error.message === "Session not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Invalid audit run payload.", "Provide sessionId.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/review/changes/bulk") {
    try {
      sendJson(response, 200, await bulkTransitionChanges(state, await readJsonBody(request)));
    } catch (error) {
      invalidRequest(response, "Invalid bulk transition payload.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/figma/writeback") {
    try {
      sendJson(response, 200, await runFigmaWriteback(state, await readJsonBody(request)));
    } catch {
      invalidRequest(response, "Invalid writeback payload.", "Provide sessionId and changeIds.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/spreadsheet/parse") {
    try {
      sendJson(response, 200, await parseSpreadsheet(state, await readJsonBody(request)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse spreadsheet.";
      invalidRequest(response, message);
    }
    return true;
  }

  if (request.method === "PATCH" && path === "/projects/guidance") {
    try {
      sendJson(response, 200, await updateProjectGuidance(state, await readJsonBody(request)));
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Invalid project guidance payload.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/review/changelog") {
    const sessionId = getQueryParam(request.url, "sessionId");

    if (!sessionId) {
      invalidRequest(response, "Missing sessionId.");
      return true;
    }

    sendJson(response, 200, getSessionChangelog(state, sessionId));
    return true;
  }

  if (request.method === "GET" && path === "/review/export/markdown") {
    const sessionId = getQueryParam(request.url, "sessionId");

    if (!sessionId) {
      invalidRequest(response, "Missing sessionId.");
      return true;
    }

    try {
      const markdown = exportReportMarkdown(buildReportArtifact(state, sessionId));
      response.writeHead(200, { "content-type": "text/markdown; charset=utf-8" });
      response.end(markdown);
    } catch (error) {
      if (error instanceof Error && error.message === "Session not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Unable to export markdown.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/review/export/json") {
    const sessionId = getQueryParam(request.url, "sessionId");

    if (!sessionId) {
      invalidRequest(response, "Missing sessionId.");
      return true;
    }

    try {
      sendJson(response, 200, JSON.parse(exportReportJson(buildReportArtifact(state, sessionId))));
    } catch (error) {
      if (error instanceof Error && error.message === "Session not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Unable to export JSON.");
    }
    return true;
  }

  if (request.method === "GET" && path === "/review/export/html") {
    const sessionId = getQueryParam(request.url, "sessionId");

    if (!sessionId) {
      invalidRequest(response, "Missing sessionId.");
      return true;
    }

    try {
      const html = renderReportHtml(state, sessionId);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
    } catch (error) {
      if (error instanceof Error && error.message === "Session not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Unable to export HTML.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/spreadsheet/export") {
    try {
      sendJson(response, 200, await exportSpreadsheetSession(state, await readJsonBody(request)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export spreadsheet.";
      invalidRequest(response, message);
    }
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

  if (request.method === "POST" && path === "/paste-text/conversations") {
    try {
      const conversation = await createPasteTextConversation(state, await readJsonBody(request));
      await state.store.save();
      sendJson(response, 201, { conversation });
    } catch {
      invalidRequest(response, "Invalid paste-text conversation payload.", "Provide projectId.");
    }
    return true;
  }

  if (request.method === "POST" && path === "/paste-text/attachments") {
    try {
      const conversation = await attachPasteTextFile(state, await readJsonBody(request));
      sendJson(response, 200, { conversation });
    } catch (error) {
      invalidRequest(
        response,
        error instanceof Error ? error.message : "Unable to attach file.",
        "Provide conversationId and a supported filePath."
      );
    }
    return true;
  }

  const pasteTextConversationMatch = path?.match(/^\/paste-text\/conversations\/([^/]+)$/);
  if (pasteTextConversationMatch && request.method === "GET") {
    const conversationId = decodeURIComponent(pasteTextConversationMatch[1]!);

    try {
      sendJson(response, 200, { conversation: getPasteTextConversation(state, conversationId) });
    } catch (error) {
      if (error instanceof Error && error.message === "Paste text conversation not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(response, "Unable to load conversation.");
    }
    return true;
  }

  const pasteTextMessageMatch = path?.match(/^\/paste-text\/conversations\/([^/]+)\/messages$/);
  if (pasteTextMessageMatch && request.method === "POST") {
    const conversationId = decodeURIComponent(pasteTextMessageMatch[1]!);

    try {
      const result = await sendPasteTextMessage(state, conversationId, await readJsonBody(request));
      sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof Error && error.message === "Paste text conversation not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(
        response,
        error instanceof Error ? error.message : "Unable to send paste-text message.",
        "Provide text and ensure an agent adapter is available."
      );
    }
    return true;
  }

  const pasteTextRegenerateMatch = path?.match(
    /^\/paste-text\/conversations\/([^/]+)\/messages\/([^/]+)\/regenerate$/
  );
  if (pasteTextRegenerateMatch && request.method === "POST") {
    const conversationId = decodeURIComponent(pasteTextRegenerateMatch[1]!);
    const assistantMessageId = decodeURIComponent(pasteTextRegenerateMatch[2]!);

    try {
      const conversation = await regeneratePasteTextAssistantMessage(
        state,
        conversationId,
        assistantMessageId,
        await readJsonBody(request)
      );
      sendJson(response, 200, { conversation });
    } catch (error) {
      if (error instanceof Error && error.message === "Paste text conversation not found") {
        notFound(response, error.message);
        return true;
      }

      invalidRequest(
        response,
        error instanceof Error ? error.message : "Unable to regenerate paste-text message.",
        "Ensure the assistant message exists and an agent adapter is available."
      );
    }
    return true;
  }

  const screenshotMatch = path?.match(/^\/sessions\/([^/]+)\/screenshots\/([^/]+)$/);
  if (screenshotMatch && request.method === "GET") {
    const sessionId = decodeURIComponent(screenshotMatch[1]!);
    const frameId = decodeURIComponent(screenshotMatch[2]!).replace(/-/g, ":");
    const filePath = resolveScreenshotPath(state, sessionId, frameId);

    try {
      await access(filePath);
      response.writeHead(200, { "content-type": "image/png" });
      createReadStream(filePath).pipe(response);
    } catch {
      notFound(response, "Screenshot not found.");
    }

    return true;
  }

  return false;
}
