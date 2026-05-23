import type { DesignContext, FigmaReviewScope } from "@writer/contracts";

export function captureDesignContext(scope: FigmaReviewScope): DesignContext {
  const capturedAt = new Date().toISOString();
  const focusNodeId = scope.kind === "frame" ? scope.nodeId : scope.kind === "flow" ? scope.nodeIds[0] : undefined;

  const hierarchy =
    scope.kind === "flow"
      ? scope.nodeIds.map((nodeId, index) => ({
          id: nodeId,
          name: `Flow step ${index + 1}`,
          type: "FRAME",
          parentId: index > 0 ? scope.nodeIds[index - 1] : undefined
        }))
      : [
          {
            id: focusNodeId ?? scope.fileKey,
            name: scope.kind === "file" ? "File root" : "Selected frame",
            type: scope.kind === "file" ? "FILE" : "FRAME"
          }
        ];

  return {
    fileKey: scope.fileKey,
    focusNodeId,
    hierarchy,
    flowOrder: scope.kind === "flow" ? scope.nodeIds : undefined,
    capturedAt
  };
}
