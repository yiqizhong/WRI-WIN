import type { DesignContext, FigmaReviewScope } from "@writer/contracts";

export function captureDesignContext(scope: FigmaReviewScope): DesignContext {
  const capturedAt = new Date().toISOString();

  return {
    fileKey: scope.fileKey,
    focusNodeId: scope.nodeId,
    hierarchy: [
      {
        id: scope.nodeId,
        name: "Selected frame",
        type: "FRAME"
      }
    ],
    capturedAt
  };
}
