import type { ReviewSession } from "@writer/contracts";
import { parseFigmaReviewScope } from "@writer/contracts";

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

export function buildFigmaDesignFrameUrl(fileKey: string, nodeId: string): string {
  const nodeIdParam = nodeId.replace(/:/g, "-");
  return `https://www.figma.com/design/${fileKey}?node-id=${nodeIdParam}`;
}

export function resolveAuditSessionFigmaLinks(session: ReviewSession): string[] {
  const scope = session.scope as Record<string, unknown>;

  if (isHttpUrl(scope.url)) {
    return [scope.url];
  }

  let figmaScope;
  try {
    figmaScope = scope.suggestedScope
      ? parseFigmaReviewScope(scope.suggestedScope)
      : parseFigmaReviewScope(scope);
  } catch {
    return [];
  }

  switch (figmaScope.kind) {
    case "frame":
      return [buildFigmaDesignFrameUrl(figmaScope.fileKey, figmaScope.nodeId)];
    case "flow":
      return figmaScope.nodeIds.map((nodeId) =>
        buildFigmaDesignFrameUrl(figmaScope.fileKey, nodeId)
      );
    case "file":
      return [`https://www.figma.com/design/${figmaScope.fileKey}`];
    default: {
      const _exhaustive: never = figmaScope;
      return _exhaustive;
    }
  }
}
