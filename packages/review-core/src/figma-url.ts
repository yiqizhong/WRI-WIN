import type { ParsedFigmaUrl } from "@writer/contracts";

const FIGMA_HOSTS = new Set(["www.figma.com", "figma.com"]);

export class FigmaUrlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaUrlParseError";
  }
}

export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new FigmaUrlParseError("Enter a valid Figma URL.");
  }

  if (!FIGMA_HOSTS.has(parsed.hostname)) {
    throw new FigmaUrlParseError("URL must point to figma.com.");
  }

  const designMatch = parsed.pathname.match(/^\/design\/([^/]+)(?:\/.*)?$/);

  if (!designMatch?.[1]) {
    throw new FigmaUrlParseError(
      "Paste a selected Figma design Frame link (figma.com/design/...?...node-id=...)."
    );
  }

  const fileKey = designMatch[1];
  const nodeIdParam = parsed.searchParams.get("node-id");
  if (!nodeIdParam) {
    throw new FigmaUrlParseError("Select a Figma Frame and paste its link with a node-id.");
  }

  const nodeId = nodeIdParam.replace(/-/g, ":");

  return {
    fileKey,
    nodeId,
    suggestedScope: { kind: "frame", fileKey, nodeId }
  };
}
