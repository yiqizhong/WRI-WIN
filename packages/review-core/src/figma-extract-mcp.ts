import type {
  ConnectionDiagnostic,
  DesignContext,
  FigmaReviewScope,
  FigmaTextExtraction,
  FigmaTextNode
} from "@writer/contracts";

import {
  collectTextRefs,
  flattenMetadataHierarchy,
  parseMetadataXml,
  type MetadataTextRef
} from "./figma-metadata-xml";
import {
  type FigmaExtractionResult,
  type McpCaller,
  mcpNotReadyDiagnostic,
  unsupportedFigmaScopeDiagnostic
} from "./mcp-caller";
import {
  extractCharactersFromDesignContext,
  isMcpCodegenNoise,
  toSurfaceCopy
} from "./figma-text-sanitize";
import { extractMcpToolText } from "./mcp-tool-text";
import { buildFigmaTextReadScript, parseFigmaTextReadResult } from "./figma-text-read-mcp";

export { extractCharactersFromDesignContext, toSurfaceCopy };

export function extractStyleHintsFromDesignContext(code: string): Record<string, unknown> | undefined {
  const hints: Record<string, unknown> = {};
  const fontSize = code.match(/fontSize:\s*['"]?(\d+)/)?.[1];
  const fontWeight = code.match(/fontWeight:\s*['"]?(\d+)/)?.[1];

  if (fontSize) {
    hints.fontSize = Number(fontSize);
  }

  if (fontWeight) {
    hints.fontWeight = Number(fontWeight);
  }

  return Object.keys(hints).length > 0 ? hints : undefined;
}

export async function extractFigmaTextNodesViaMcp(
  scope: FigmaReviewScope,
  mcpCaller: McpCaller
): Promise<FigmaExtractionResult> {
  if (mcpCaller.status !== "connected") {
    return { ok: false, diagnostic: mcpNotReadyDiagnostic() };
  }

  const scopeError = validateExtractionScope(scope);

  if (scopeError) {
    return { ok: false, diagnostic: scopeError };
  }

  const metadataXml = await fetchMetadataXml(scope, mcpCaller);

  if (!metadataXml.ok) {
    return metadataXml;
  }

  const textRefs = collectTextRefs(parseMetadataXml(metadataXml.xml));
  const nodes: FigmaTextNode[] = [];

  for (const ref of textRefs) {
    const node = await buildTextNode(scope, ref, mcpCaller);

    if (node) {
      nodes.push(node);
    }
  }

  const extraction: FigmaTextExtraction = {
    scope: scope as unknown as Record<string, unknown>,
    nodes,
    extractedAt: new Date().toISOString()
  };

  const designContext = captureDesignContextViaMcp(scope, metadataXml.xml);

  return {
    ok: true,
    extraction,
    designContext,
    metadataXml: metadataXml.xml
  };
}

export function captureDesignContextViaMcp(scope: FigmaReviewScope, metadataXml: string): DesignContext {
  const hierarchy = flattenMetadataHierarchy(parseMetadataXml(metadataXml)).map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    parentId: node.parentId
  }));

  const focusNodeId =
    scope.kind === "frame" ? scope.nodeId : scope.kind === "flow" ? scope.nodeIds[0] : undefined;

  return {
    fileKey: scope.fileKey,
    focusNodeId,
    hierarchy,
    flowOrder: scope.kind === "flow" ? scope.nodeIds : undefined,
    capturedAt: new Date().toISOString()
  };
}

function validateExtractionScope(scope: FigmaReviewScope): ConnectionDiagnostic | null {
  if (scope.kind === "file") {
    return unsupportedFigmaScopeDiagnostic(
      "File-wide Figma review is not supported for MCP extraction.",
      "Paste a frame URL that includes a node-id query parameter."
    );
  }

  return null;
}

async function fetchMetadataXml(
  scope: FigmaReviewScope,
  mcpCaller: McpCaller
): Promise<{ ok: true; xml: string } | { ok: false; diagnostic: ConnectionDiagnostic }> {
  if (scope.kind === "flow") {
    const chunks: string[] = [];

    for (const nodeId of scope.nodeIds) {
      const chunk = await callGetMetadata(scope.fileKey, nodeId, mcpCaller);

      if (!chunk.ok) {
        return chunk;
      }

      chunks.push(chunk.xml);
    }

    return { ok: true, xml: chunks.join("\n") };
  }

  const nodeId = scope.kind === "frame" ? scope.nodeId : undefined;
  return callGetMetadata(scope.fileKey, nodeId, mcpCaller);
}

async function callGetMetadata(
  fileKey: string,
  nodeId: string | undefined,
  mcpCaller: McpCaller
): Promise<{ ok: true; xml: string } | { ok: false; diagnostic: ConnectionDiagnostic }> {
  const args: Record<string, unknown> = { fileKey };

  if (nodeId) {
    args.nodeId = nodeId;
  }

  const response = await mcpCaller.callTool("get_metadata", args);

  if (!response.ok) {
    return {
      ok: false,
      diagnostic: response.diagnostic ?? {
        code: "smoke_failed",
        severity: "error",
        message: "Figma MCP get_metadata failed.",
        recoveryAction: "Check Figma MCP connection and file access."
      }
    };
  }

  const xml = extractMcpToolText(response.result);

  if (!xml) {
    return {
      ok: false,
      diagnostic: {
        code: "smoke_failed",
        severity: "error",
        message: "Figma MCP get_metadata returned no XML payload.",
        recoveryAction: "Retry the audit or reconnect Figma MCP."
      }
    };
  }

  return { ok: true, xml };
}

async function buildTextNode(
  scope: FigmaReviewScope,
  ref: MetadataTextRef,
  mcpCaller: McpCaller
): Promise<FigmaTextNode | null> {
  try {
    const readCharacters = await readTextCharactersViaMcp(scope.fileKey, ref.id, mcpCaller);

    if (readCharacters) {
      return {
        id: ref.id,
        name: ref.name,
        path: ref.path,
        characters: readCharacters,
        visible: ref.visible
      };
    }

    const response = await mcpCaller.callTool("get_design_context", {
      fileKey: scope.fileKey,
      nodeId: ref.id
    });

    if (!response.ok) {
      return null;
    }

    const code = extractMcpToolText(response.result) ?? "";
    const characters = toSurfaceCopy(extractCharactersFromDesignContext(code, ref.name));

    if (!characters || (isMcpCodegenNoise(characters) && characters !== ref.name)) {
      return null;
    }

    return {
      id: ref.id,
      name: ref.name,
      path: ref.path,
      characters,
      styleHints: extractStyleHintsFromDesignContext(code),
      visible: ref.visible
    };
  } catch {
    return null;
  }
}

async function readTextCharactersViaMcp(
  fileKey: string,
  nodeId: string,
  mcpCaller: McpCaller
): Promise<string | null> {
  const response = await mcpCaller.callTool("use_figma", {
    fileKey,
    code: buildFigmaTextReadScript(nodeId),
    description: `Read TEXT node ${nodeId} characters`,
    skillNames: "figma-use"
  });

  if (!response.ok) {
    return null;
  }

  const payloadText = extractMcpToolText(response.result);

  if (!payloadText) {
    return null;
  }

  const parsed = parseFigmaTextReadResult(payloadText);

  if (!parsed) {
    return null;
  }

  const sanitized = toSurfaceCopy(parsed.characters);

  if (!sanitized || isMcpCodegenNoise(sanitized)) {
    return null;
  }

  return sanitized;
}
