import { parseFigmaUrlInputSchema, type ParsedFigmaUrl } from "@writer/contracts";
import {
  extractMcpToolText,
  findMetadataNodeById,
  parseFigmaUrl,
  parseMetadataXml
} from "@writer/review-core";

import { createFigmaMcpCaller } from "./figma-mcp-caller";
import type { DaemonState } from "./state";

export async function parseFigmaUrlWithFrameName(
  state: DaemonState,
  input: unknown
): Promise<ParsedFigmaUrl> {
  const parsed = parseFigmaUrlInputSchema.parse(input);
  const result = parseFigmaUrl(parsed.url);

  if (!result.nodeId) {
    return result;
  }

  const mcpCaller = createFigmaMcpCaller(state);

  if (mcpCaller.status !== "connected") {
    return result;
  }

  try {
    const response = await mcpCaller.callTool("get_metadata", {
      fileKey: result.fileKey,
      nodeId: result.nodeId
    });

    if (!response.ok) {
      return result;
    }

    const xml = extractMcpToolText(response.result);

    if (!xml) {
      return result;
    }

    const match = findMetadataNodeById(parseMetadataXml(xml), result.nodeId);

    if (!match?.name) {
      return result;
    }

    const frameName = match.name;
    const suggestedScope =
      result.suggestedScope.kind === "frame"
        ? { ...result.suggestedScope, frameName }
        : result.suggestedScope;

    return {
      ...result,
      frameName,
      suggestedScope
    };
  } catch {
    return result;
  }
}
