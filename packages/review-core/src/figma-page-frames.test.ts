import { describe, expect, it } from "vitest";

import { parseMetadataXml } from "./figma-metadata-xml";
import {
  buildListPageFramesResponse,
  detectFlowDirection,
  sortFramesByDirection
} from "./figma-page-frames";
import type { PageFrameListItem } from "@writer/contracts";

const HORIZONTAL_PAGE = `
<frame id="0:1" name="Page" type="FRAME">
  <frame id="1:10" name="Step A" type="FRAME" x="0" y="0" width="200" height="400" />
  <frame id="1:20" name="Step B" type="FRAME" x="300" y="0" width="200" height="400" />
</frame>
`;

const VERTICAL_PAGE = `
<frame id="0:1" name="Page" type="FRAME">
  <frame id="2:10" name="Step A" type="FRAME" x="0" y="0" width="320" height="200" />
  <frame id="2:20" name="Step B" type="FRAME" x="0" y="280" width="320" height="200" />
</frame>
`;

const GRID_PAGE = `
<frame id="0:1" name="Page" type="FRAME">
  <frame id="3:10" name="A" type="FRAME" x="0" y="0" width="100" height="100" />
  <frame id="3:20" name="B" type="FRAME" x="120" y="0" width="100" height="100" />
  <frame id="3:30" name="C" type="FRAME" x="0" y="120" width="100" height="100" />
</frame>
`;

function framesWithBoxes(
  items: Array<{ nodeId: string; x: number; y: number; width?: number; height?: number }>
): PageFrameListItem[] {
  return items.map((item) => ({
    nodeId: item.nodeId,
    name: item.nodeId,
    parentPath: "Page",
    boundingBox: {
      x: item.x,
      y: item.y,
      width: item.width ?? 100,
      height: item.height ?? 100
    }
  }));
}

describe("figma-page-frames", () => {
  it("detects horizontal layout and sorts by x", () => {
    const response = buildListPageFramesResponse(parseMetadataXml(HORIZONTAL_PAGE));
    expect(response.detectedDirection).toBe("horizontal");
    expect(response.frames.map((frame) => frame.nodeId)).toEqual(["1:10", "1:20"]);
  });

  it("detects vertical layout and sorts by y", () => {
    const response = buildListPageFramesResponse(parseMetadataXml(VERTICAL_PAGE));
    expect(response.detectedDirection).toBe("vertical");
    expect(response.frames.map((frame) => frame.nodeId)).toEqual(["2:10", "2:20"]);
  });

  it("detects grid layout with row-major order", () => {
    const response = buildListPageFramesResponse(parseMetadataXml(GRID_PAGE));
    expect(response.detectedDirection).toBe("grid");
    expect(response.frames.map((frame) => frame.nodeId)).toEqual(["3:10", "3:20", "3:30"]);
  });

  it("sorts horizontal frames by x", () => {
    const frames = framesWithBoxes([
      { nodeId: "b", x: 200, y: 0 },
      { nodeId: "a", x: 0, y: 0 }
    ]);
    expect(sortFramesByDirection(frames, "horizontal").map((frame) => frame.nodeId)).toEqual(["a", "b"]);
  });

  it("excludes sections and collects frames nested inside them", () => {
    const metadata = `
<frame id="0:1" name="Page" type="FRAME">
  <section id="4:1" name="Onboarding section">
    <frame id="4:10" name="Step A" type="FRAME" x="0" y="0" width="200" height="400" />
    <frame id="4:20" name="Step B" type="FRAME" x="300" y="0" width="200" height="400" />
  </section>
  <frame id="4:30" name="Standalone" type="FRAME" x="600" y="0" width="200" height="400" />
</frame>
`;
    const response = buildListPageFramesResponse(parseMetadataXml(metadata));

    expect(response.frames.map((frame) => frame.nodeId)).toEqual(["4:10", "4:20", "4:30"]);
    expect(response.frames.some((frame) => frame.name.includes("section"))).toBe(false);
  });

  it("ignores rectangles and other non-frame nodes", () => {
    const metadata = `
<frame id="0:1" name="Page" type="FRAME">
  <rounded-rectangle id="5:1" name="Backdrop" type="RECTANGLE" x="0" y="0" width="800" height="600" />
  <frame id="5:10" name="Screen" type="FRAME" x="40" y="40" width="320" height="640" />
</frame>
`;
    const response = buildListPageFramesResponse(parseMetadataXml(metadata));

    expect(response.frames.map((frame) => frame.nodeId)).toEqual(["5:10"]);
  });

  it("classifies near-square spans as grid", () => {
    const frames = framesWithBoxes([
      { nodeId: "a", x: 0, y: 0, width: 100, height: 100 },
      { nodeId: "b", x: 100, y: 100, width: 100, height: 100 }
    ]);
    expect(detectFlowDirection(frames)).toBe("grid");
  });
});
