import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PlatformStore } from "@writer/storage";
import { describe, expect, it } from "vitest";

import { createDefaultMcpState } from "./mcp";
import { listFigmaPageFrames } from "./figma-page-frames";
import type { DaemonState } from "./state";

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

function createMetadataClient(metadata: string) {
  return {
    callTool: async (name: string) => {
      if (name === "get_metadata") {
        return {
          ok: true,
          result: { content: [{ type: "text", text: metadata }] }
        };
      }

      return { ok: false, diagnostic: { code: "smoke_failed", severity: "error", message: "unexpected tool" } };
    }
  };
}

async function createTestState(metadata: string): Promise<DaemonState> {
  const dataDir = await mkdtemp(join(tmpdir(), "writer-figma-page-frames-"));
  const store = new PlatformStore({ dataDir });
  await store.load();

  const mcp = createDefaultMcpState();
  mcp.figma.status = "connected";
  mcp.figmaClient = createMetadataClient(metadata) as never;

  return {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp
  };
}

describe("listFigmaPageFrames", () => {
  it("returns horizontal frames sorted by x", async () => {
    const state = await createTestState(HORIZONTAL_PAGE);
    const result = await listFigmaPageFrames(state, {
      pageUrl: "https://www.figma.com/design/abc/Demo?node-id=0-1"
    });

    expect(result.detectedDirection).toBe("horizontal");
    expect(result.frames.map((frame) => frame.nodeId)).toEqual(["1:10", "1:20"]);
  });

  it("returns vertical frames sorted by y", async () => {
    const state = await createTestState(VERTICAL_PAGE);
    const result = await listFigmaPageFrames(state, {
      pageUrl: "https://www.figma.com/design/abc/Demo?node-id=0-1"
    });

    expect(result.detectedDirection).toBe("vertical");
    expect(result.frames.map((frame) => frame.nodeId)).toEqual(["2:10", "2:20"]);
  });

  it("returns grid frames in row-major order", async () => {
    const state = await createTestState(GRID_PAGE);
    const result = await listFigmaPageFrames(state, {
      pageUrl: "https://www.figma.com/design/abc/Demo?node-id=0-1"
    });

    expect(result.detectedDirection).toBe("grid");
    expect(result.frames.map((frame) => frame.nodeId)).toEqual(["3:10", "3:20", "3:30"]);
  });

  it("returns a single frame page", async () => {
    const metadata = `<frame id="9:1" name="Only" type="FRAME" x="0" y="0" width="100" height="100" />`;
    const state = await createTestState(metadata);
    const result = await listFigmaPageFrames(state, {
      pageUrl: "https://www.figma.com/design/abc/Demo?node-id=9-1"
    });

    expect(result.frames).toHaveLength(1);
    expect(result.frames[0]?.nodeId).toBe("9:1");
  });

  it("rejects invalid URLs", async () => {
    const state = await createTestState(HORIZONTAL_PAGE);

    await expect(
      listFigmaPageFrames(state, { pageUrl: "https://example.com/not-figma" })
    ).rejects.toThrow();
  });

  it("surfaces mcp_not_ready when disconnected", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "writer-figma-page-frames-offline-"));
    const store = new PlatformStore({ dataDir });
    await store.load();
    const state: DaemonState = {
      store,
      permissionRequests: [],
      activeRuns: new Map(),
      mcp: createDefaultMcpState()
    };

    await expect(
      listFigmaPageFrames(state, {
        pageUrl: "https://www.figma.com/design/abc/Demo?node-id=0-1"
      })
    ).rejects.toMatchObject({
      diagnostic: expect.objectContaining({ code: "mcp_not_ready" })
    });
  });
});
