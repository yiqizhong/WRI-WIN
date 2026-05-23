import type { FigmaReviewScope, FigmaTextExtraction, FigmaTextNode } from "@writer/contracts";

export function extractFigmaTextNodes(scope: FigmaReviewScope): FigmaTextExtraction {
  const nodes: FigmaTextNode[] = buildStubNodes(scope);

  return {
    scope,
    nodes,
    extractedAt: new Date().toISOString()
  };
}

function buildStubNodes(scope: FigmaReviewScope): FigmaTextNode[] {
  if (scope.kind === "flow") {
    return scope.nodeIds.map((nodeId, index) => ({
      id: nodeId,
      name: `Screen ${index + 1} title`,
      path: ["Document", scope.flowName ?? "Flow", `Step ${index + 1}`],
      characters: `Sample headline for step ${index + 1}`,
      styleHints: { fontSize: 24 },
      visible: true
    }));
  }

  const nodeId = scope.kind === "frame" ? scope.nodeId : `${scope.fileKey}:root`;
  const frameName = scope.kind === "frame" ? scope.frameName ?? "Selected frame" : "File";

  return [
    {
      id: nodeId,
      name: "Primary CTA",
      path: ["Document", frameName, "Primary CTA"],
      characters: "Continue",
      styleHints: { fontWeight: 600 },
      visible: true
    },
    {
      id: `${nodeId}:subtitle`,
      name: "Subtitle",
      path: ["Document", frameName, "Subtitle"],
      characters: "Review your UX copy before publishing.",
      visible: true
    }
  ];
}
