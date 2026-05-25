import {
  parseListPageFramesRequest,
  type ListPageFramesResponse
} from "@writer/contracts";
import {
  buildListPageFramesResponse,
  extractMcpToolText,
  FigmaUrlParseError,
  mcpNotReadyDiagnostic,
  parseFigmaUrl,
  parseMetadataXml
} from "@writer/review-core";

import { createFigmaMcpCaller } from "./figma-mcp-caller";
import type { DaemonState } from "./state";

export async function listFigmaPageFrames(
  state: DaemonState,
  input: unknown
): Promise<ListPageFramesResponse> {
  const parsed = parseListPageFramesRequest(input);
  const figma = parseFigmaUrl(parsed.pageUrl);
  const mcpCaller = createFigmaMcpCaller(state);

  if (mcpCaller.status !== "connected") {
    throw Object.assign(new Error(mcpNotReadyDiagnostic().message), {
      diagnostic: mcpNotReadyDiagnostic()
    });
  }

  const response = await mcpCaller.callTool("get_metadata", {
    fileKey: figma.fileKey,
    nodeId: figma.nodeId
  });

  if (!response.ok) {
    throw new Error(response.diagnostic?.message ?? "Figma MCP get_metadata failed.");
  }

  const xml = extractMcpToolText(response.result);

  if (!xml) {
    throw new Error("Figma MCP get_metadata returned no XML payload.");
  }

  return buildListPageFramesResponse(parseMetadataXml(xml));
}

export function assertFigmaPageUrl(pageUrl: string): { fileKey: string; nodeId?: string } {
  try {
    return parseFigmaUrl(pageUrl);
  } catch (error) {
    if (error instanceof FigmaUrlParseError) {
      throw error;
    }

    throw new FigmaUrlParseError("Invalid Figma page URL.");
  }
}
