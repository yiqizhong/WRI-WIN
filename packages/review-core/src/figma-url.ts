import type { FigmaReviewScope, ParsedFigmaUrl } from "@writer/contracts";

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
    throw new FigmaUrlParseError("Use a Figma design file URL (figma.com/design/...).");
  }

  const fileKey = designMatch[1];
  const nodeIdParam = parsed.searchParams.get("node-id");
  const nodeId = nodeIdParam ? nodeIdParam.replace(/-/g, ":") : undefined;

  const suggestedScope: FigmaReviewScope = nodeId
    ? { kind: "frame", fileKey, nodeId }
    : { kind: "file", fileKey };

  return {
    fileKey,
    nodeId,
    suggestedScope
  };
}
