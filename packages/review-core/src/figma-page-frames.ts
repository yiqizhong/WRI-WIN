import type { FlowDirection, PageFrameListItem } from "@writer/contracts";

import type { MetadataXmlNode } from "./figma-metadata-xml";

const DIRECTION_RATIO = 1.2;

function isUiFrameType(type: string): boolean {
  return type.toUpperCase() === "FRAME";
}

function toPageFrameListItem(node: MetadataXmlNode): PageFrameListItem {
  return {
    nodeId: node.id,
    name: node.name,
    parentPath: node.path.slice(0, -1).join(" / ") || node.path.join(" / "),
    boundingBox: node.boundingBox ?? { x: 0, y: 0, width: 0, height: 0 }
  };
}

function withDefaultBoundingBoxes(frames: PageFrameListItem[]): PageFrameListItem[] {
  return frames.map((frame, index) => ({
    ...frame,
    boundingBox:
      frame.boundingBox.width > 0
        ? frame.boundingBox
        : {
            x: index * 120,
            y: 0,
            width: 100,
            height: 200
          }
  }));
}

export function listDirectPageFrames(roots: MetadataXmlNode[]): PageFrameListItem[] {
  const frames: PageFrameListItem[] = [];
  const seen = new Set<string>();

  function pushFrame(node: MetadataXmlNode): void {
    if (seen.has(node.id)) {
      return;
    }

    seen.add(node.id);
    frames.push(toPageFrameListItem(node));
  }

  function collectUnderContainer(node: MetadataXmlNode): void {
    for (const child of node.children) {
      if (isUiFrameType(child.type)) {
        pushFrame(child);
        continue;
      }

      collectUnderContainer(child);
    }
  }

  for (const [index, root] of roots.entries()) {
    if (index === 0) {
      collectUnderContainer(root);
      continue;
    }

    if (isUiFrameType(root.type)) {
      pushFrame(root);
      continue;
    }

    collectUnderContainer(root);
  }

  if (frames.length === 0 && roots.length === 1 && isUiFrameType(roots[0]!.type)) {
    return withDefaultBoundingBoxes([toPageFrameListItem(roots[0]!)]);
  }

  return withDefaultBoundingBoxes(frames);
}

export function detectFlowDirection(frames: PageFrameListItem[]): FlowDirection {
  if (frames.length <= 1) {
    return "vertical";
  }

  const minX = Math.min(...frames.map((frame) => frame.boundingBox.x));
  const maxX = Math.max(...frames.map((frame) => frame.boundingBox.x + frame.boundingBox.width));
  const minY = Math.min(...frames.map((frame) => frame.boundingBox.y));
  const maxY = Math.max(...frames.map((frame) => frame.boundingBox.y + frame.boundingBox.height));
  const xSpan = maxX - minX;
  const ySpan = maxY - minY;

  if (xSpan > ySpan * DIRECTION_RATIO) {
    return "horizontal";
  }

  if (ySpan > xSpan * DIRECTION_RATIO) {
    return "vertical";
  }

  return "grid";
}

export function sortFramesByDirection(
  frames: PageFrameListItem[],
  direction: FlowDirection
): PageFrameListItem[] {
  const copy = [...frames];

  if (direction === "horizontal") {
    return copy.sort((left, right) => left.boundingBox.x - right.boundingBox.x);
  }

  if (direction === "vertical") {
    return copy.sort((left, right) => left.boundingBox.y - right.boundingBox.y);
  }

  const rowHeight = Math.max(1, ...copy.map((frame) => frame.boundingBox.height || 1));

  return copy.sort((left, right) => {
    const leftRow = Math.round(left.boundingBox.y / rowHeight);
    const rightRow = Math.round(right.boundingBox.y / rowHeight);

    if (leftRow !== rightRow) {
      return leftRow - rightRow;
    }

    return left.boundingBox.x - right.boundingBox.x;
  });
}

export function buildListPageFramesResponse(roots: MetadataXmlNode[]) {
  const frames = listDirectPageFrames(roots);
  const detectedDirection = detectFlowDirection(frames);

  return {
    frames: sortFramesByDirection(frames, detectedDirection),
    detectedDirection
  };
}
