import type { FigmaReviewScope, FigmaTextExtraction, FigmaTextNode } from "@writer/contracts";

export function extractFigmaTextNodes(scope: FigmaReviewScope): FigmaTextExtraction {
  const nodes: FigmaTextNode[] = buildStubNodes(scope);

  return {
    scope,
    nodes,
    warnings: [],
    extractedAt: new Date().toISOString()
  };
}

function buildStubNodes(scope: FigmaReviewScope): FigmaTextNode[] {
  const nodeId = scope.nodeId;
  const frameName = scope.frameName ?? "Selected frame";

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
