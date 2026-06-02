import type {
  ConnectionDiagnostic,
  DesignContext,
  FigmaReviewScope,
  FigmaTextExtraction,
  FigmaTextNode
} from "@writer/contracts";

import {
  collectInstanceRefs,
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
  isExtractableFigmaText,
  toExtractedCopy,
  toSurfaceCopy
} from "./figma-text-sanitize";
import { extractMcpToolText } from "./mcp-tool-text";
import {
  buildFigmaFrameTextScanScript,
  buildFigmaTextReadScript,
  parseFigmaFrameTextScanResult,
  parseFigmaTextReadResult,
  type FigmaScannedTextNode
} from "./figma-text-read-mcp";

export { extractCharactersFromDesignContext, toExtractedCopy, toSurfaceCopy };

const MAX_EXTRACTION_NODES = Number(process.env.WRITER_FIGMA_MAX_NODES) || 500;
const EXTRACTION_CONCURRENCY = Number(process.env.WRITER_FIGMA_READ_CONCURRENCY) || 8;

function textNodeFromRef(
  ref: MetadataTextRef,
  characters: string,
  styleHints?: Record<string, unknown>
): FigmaTextNode {
  return {
    id: ref.id,
    name: ref.name,
    path: ref.path,
    characters,
    styleHints,
    visible: ref.visible
  };
}

function resolveExtractedCharacters(
  ref: MetadataTextRef,
  candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) {
      continue;
    }

    const copy = toExtractedCopy(candidate);

    if (isExtractableFigmaText(copy)) {
      return copy;
    }
  }

  const fromName = toExtractedCopy(ref.name);

  if (isExtractableFigmaText(fromName)) {
    return fromName;
  }

  return "";
}

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

  const metadataNodes = parseMetadataXml(metadataXml.xml);
  const textRefs = collectTextRefs(metadataNodes);
  const instanceRefs = collectInstanceRefs(metadataNodes);

  // get_metadata XML omits TEXT nodes inside INSTANCE children. When the frame
  // contains instances, run a single use_figma scan to discover them.
  const scannedFromInstances =
    instanceRefs.length > 0
      ? await scanInstanceTextNodes(scope, instanceRefs, textRefs, mcpCaller)
      : [];

  // Merge refs for cap counting. Instance-scanned nodes already have characters
  // resolved by the frame scan — cache them so the pool can skip redundant MCP calls.
  const scannedById = new Map(scannedFromInstances.map((n) => [n.id, n]));
  const allRefs: MetadataTextRef[] = [
    ...textRefs,
    ...scannedFromInstances.map((n) => ({
      id: n.id,
      name: n.name,
      path: n.path,
      visible: n.visible
    }))
  ];

  const totalRefs = allRefs.length;
  const cappedRefs = allRefs.slice(0, MAX_EXTRACTION_NODES);

  const warnings: ConnectionDiagnostic[] = [];

  if (totalRefs > MAX_EXTRACTION_NODES) {
    warnings.push({
      code: "partial_read_failure",
      severity: "info",
      message: `Extracted the first ${MAX_EXTRACTION_NODES} of ${totalRefs} text nodes; the rest were skipped`
    });
  }

  const nodes = new Array<FigmaTextNode>(cappedRefs.length);
  let index = 0;
  async function worker() {
    while (index < cappedRefs.length) {
      const i = index++;
      const ref = cappedRefs[i];
      nodes[i] = scannedById.get(ref.id) ?? await buildTextNode(scope, ref, mcpCaller);
    }
  }
  await Promise.all(Array.from({ length: Math.min(EXTRACTION_CONCURRENCY, cappedRefs.length) }, worker));

  const extraction: FigmaTextExtraction = {
    scope,
    nodes,
    warnings,
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
): Promise<FigmaTextNode> {
  try {
    const readCharacters = await readTextCharactersViaMcp(scope.fileKey, ref.id, mcpCaller);

    if (readCharacters !== null) {
      return textNodeFromRef(ref, readCharacters);
    }

    const response = await mcpCaller.callTool("get_design_context", {
      fileKey: scope.fileKey,
      nodeId: ref.id
    });

    if (!response.ok) {
      return textNodeFromRef(ref, resolveExtractedCharacters(ref, []));
    }

    const code = extractMcpToolText(response.result) ?? "";
    const raw = extractCharactersFromDesignContext(code, ref.name);
    const characters = resolveExtractedCharacters(ref, [raw]);

    return textNodeFromRef(ref, characters, extractStyleHintsFromDesignContext(code));
  } catch {
    return textNodeFromRef(ref, resolveExtractedCharacters(ref, []));
  }
}

async function scanInstanceTextNodes(
  scope: FigmaReviewScope,
  instanceRefs: ReturnType<typeof collectInstanceRefs>,
  existingTextRefs: MetadataTextRef[],
  mcpCaller: McpCaller
): Promise<FigmaTextNode[]> {
  const existingIds = new Set(existingTextRefs.map((r) => r.id));
  const rootId = scope.kind === "frame" ? scope.nodeId : scope.kind === "flow" ? scope.nodeIds[0] : undefined;

  if (!rootId) {
    return [];
  }

  const response = await mcpCaller.callTool("use_figma", {
    fileKey: scope.fileKey,
    code: buildFigmaFrameTextScanScript(rootId),
    description: `Scan TEXT nodes inside component instances in frame ${rootId}`,
    skillNames: "figma-use"
  });

  if (!response.ok) {
    // Instance scan is best-effort: metadata-derived TEXT nodes are still
    // returned by the caller. Log so a failing scan is visible, not silent.
    console.warn("[review-core] instance TEXT scan failed; skipping instance nodes", {
      rootId,
      diagnostic: response.diagnostic?.code
    });
    return [];
  }

  const payloadText = extractMcpToolText(response.result);
  if (!payloadText) return [];

  const scanned = parseFigmaFrameTextScanResult(payloadText);
  const nodes: FigmaTextNode[] = [];

  for (const scannedNode of scanned) {
    // Only include nodes that the XML metadata missed (i.e. inside instances)
    if (existingIds.has(scannedNode.id)) continue;

    const isInsideInstance = instanceRefs.some(
      (inst) =>
        scannedNode.path.length > inst.path.length &&
        inst.path.every((seg, i) => scannedNode.path[i] === seg)
    );

    if (!isInsideInstance) continue;

    existingIds.add(scannedNode.id);
    nodes.push(textNodeFromScanned(scannedNode));
  }

  return nodes;
}

function textNodeFromScanned(scanned: FigmaScannedTextNode): FigmaTextNode {
  const characters = resolveExtractedCharacters(
    { id: scanned.id, name: scanned.name, path: scanned.path, visible: scanned.visible },
    [scanned.characters]
  );
  return {
    id: scanned.id,
    name: scanned.name,
    path: scanned.path,
    characters,
    visible: scanned.visible
  };
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

  const sanitized = toExtractedCopy(parsed.characters);

  if (!isExtractableFigmaText(sanitized)) {
    return null;
  }

  return sanitized;
}
