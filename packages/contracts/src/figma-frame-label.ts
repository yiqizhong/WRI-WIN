import type { DesignContext } from "./design-context";
import { parseFigmaReviewScope } from "./figma-scope";
import type { ReviewSession } from "./review-session";

function decodeFigmaEntityName(name: string): string {
  return name
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function designContextFromSession(session: Pick<ReviewSession, "scope" | "designContext">): DesignContext | undefined {
  const scope = session.scope as Record<string, unknown>;
  const fromScope = scope.designContext;

  if (fromScope && typeof fromScope === "object") {
    return fromScope as DesignContext;
  }

  return session.designContext;
}

/** Display label for a Figma frame node on audit report screens. */
export function resolveFigmaFrameDisplayName(
  session: Pick<ReviewSession, "scope" | "designContext">,
  frameId: string
): string {
  const hierarchyName = designContextFromSession(session)?.hierarchy.find((node) => node.id === frameId)?.name;

  if (hierarchyName) {
    return decodeFigmaEntityName(hierarchyName);
  }

  const scope = session.scope as Record<string, unknown>;

  try {
    const figmaScope = scope.suggestedScope
      ? parseFigmaReviewScope(scope.suggestedScope)
      : parseFigmaReviewScope(scope);

    if (figmaScope.kind === "frame") {
      if (figmaScope.frameName) {
        return decodeFigmaEntityName(figmaScope.frameName);
      }

      return frameId;
    }

    if (figmaScope.kind === "flow") {
      const fromMap = figmaScope.nodeNames?.[frameId];

      if (fromMap) {
        return decodeFigmaEntityName(fromMap);
      }
    }
  } catch {
    // Scope is not a valid Figma review scope; fall through.
  }

  return frameId;
}
