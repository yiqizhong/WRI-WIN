import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { FrameScreenshot, ReviewSession } from "@writer/contracts";
import { parseFigmaReviewScope } from "@writer/contracts";
import { extractMcpToolText } from "@writer/review-core";

import { createFigmaMcpCaller } from "./figma-mcp-caller";
import type { DaemonState } from "./state";

function frameIdsFromSession(session: ReviewSession): string[] {
  const scope = session.scope as Record<string, unknown>;
  const figmaScope = scope.suggestedScope
    ? parseFigmaReviewScope(scope.suggestedScope)
    : parseFigmaReviewScope(scope);

  if (figmaScope.kind === "frame") {
    return [figmaScope.nodeId];
  }

  if (figmaScope.kind === "flow") {
    return figmaScope.nodeIds;
  }

  return [];
}

function extractScreenshotBytes(result: unknown): Buffer | null {
  const text = extractMcpToolText(result);

  if (text?.startsWith("data:image")) {
    const base64 = text.split(",")[1];
    return base64 ? Buffer.from(base64, "base64") : null;
  }

  if (!result || typeof result !== "object") {
    return null;
  }

  const content = (result as { content?: unknown }).content;

  if (!Array.isArray(content)) {
    return null;
  }

  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }

    const typed = block as { type?: string; data?: string; mimeType?: string };

    if (typed.type === "image" && typeof typed.data === "string") {
      return Buffer.from(typed.data, "base64");
    }
  }

  return text ? Buffer.from(text, "utf8") : null;
}

export async function captureSessionFrameScreenshots(
  state: DaemonState,
  session: ReviewSession
): Promise<FrameScreenshot[]> {
  const scope = session.scope as Record<string, unknown>;
  const figmaScope = scope.suggestedScope
    ? parseFigmaReviewScope(scope.suggestedScope)
    : parseFigmaReviewScope(scope);
  const frameIds = frameIdsFromSession(session);

  if (frameIds.length === 0) {
    return [];
  }

  const mcpCaller = createFigmaMcpCaller(state);

  if (mcpCaller.status !== "connected") {
    return [];
  }

  const screenshotDir = join(state.store.dataDir, "sessions", session.id, "screenshots");
  await mkdir(screenshotDir, { recursive: true });

  const screenshots: FrameScreenshot[] = [];

  for (const frameId of frameIds) {
    try {
      const response = await mcpCaller.callTool("get_screenshot", {
        fileKey: figmaScope.fileKey,
        nodeId: frameId
      });

      if (!response.ok) {
        continue;
      }

      const bytes = extractScreenshotBytes(response.result);

      if (!bytes || bytes.length === 0) {
        continue;
      }

      const safeId = frameId.replace(/:/g, "-");
      const filePath = join(screenshotDir, `${safeId}.png`);
      await writeFile(filePath, bytes);
      screenshots.push({ frameId, fileRef: filePath });
    } catch {
      // Non-fatal per-frame screenshot failure.
    }
  }

  return screenshots;
}

export function resolveScreenshotPath(
  state: DaemonState,
  sessionId: string,
  frameId: string
): string {
  const safeId = frameId.replace(/:/g, "-");
  return join(state.store.dataDir, "sessions", sessionId, "screenshots", `${safeId}.png`);
}
