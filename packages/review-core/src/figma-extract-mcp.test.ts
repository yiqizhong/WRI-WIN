import { describe, expect, it } from "vitest";

import type { FigmaReviewScope } from "@writer/contracts";

import { extractFigmaTextNodesViaMcp } from "./figma-extract-mcp";
import { collectTextRefs, parseMetadataXml } from "./figma-metadata-xml";
import type { McpCaller } from "./mcp-caller";

const FRAME_METADATA = `
<frame id="1:10" name="Login" type="FRAME">
  <text id="1:11" name="Primary CTA" type="TEXT" visible="true" />
  <text id="1:12" name="Subtitle" type="TEXT" visible="true" />
</frame>
`;

const FLOW_METADATA = `
<frame id="2:1" name="Step 1" type="FRAME">
  <text id="2:2" name="Headline" type="TEXT" visible="true" />
</frame>
`;

function createFakeCaller(options: {
  status?: McpCaller["status"];
  metadata?: string;
  designContextByNode?: Record<string, string>;
  failDesignContextFor?: string;
  failReadFor?: string;
}): McpCaller {
  const metadata = options.metadata ?? FRAME_METADATA;
  const designContextByNode = options.designContextByNode ?? {
    "1:11": "Continue to checkout",
    "1:12": "Review your UX copy before publishing.",
    "2:2": "Welcome back"
  };

  return {
    status: options.status ?? "connected",
    callTool: async (name, args) => {
      if (name === "get_metadata") {
        return {
          ok: true,
          result: { content: [{ type: "text", text: metadata }] }
        };
      }

      if (name === "use_figma" && String(args.code).includes("return { nodeId")) {
        const nodeIdMatch = String(args.code).match(/nodeId = "([^"]+)"/);
        const nodeId = nodeIdMatch?.[1] ?? "";

        if (options.failReadFor === nodeId) {
          return {
            ok: false,
            diagnostic: {
              code: "smoke_failed",
              severity: "error",
              message: "read failed"
            }
          };
        }

        const characters = designContextByNode[nodeId] ?? nodeId;

        return {
          ok: true,
          result: {
            content: [{ type: "text", text: JSON.stringify({ nodeId, characters }) }]
          }
        };
      }

      if (name === "get_design_context") {
        const nodeId = String(args.nodeId ?? "");

        if (options.failDesignContextFor === nodeId) {
          return {
            ok: false,
            diagnostic: {
              code: "smoke_failed",
              severity: "error",
              message: "design context failed"
            }
          };
        }

        const code = designContextByNode[nodeId] ?? `<span>${nodeId}</span>`;

        return {
          ok: true,
          result: { content: [{ type: "text", text: code }] }
        };
      }

      return { ok: false };
    }
  };
}

describe("figma metadata xml", () => {
  it("collects TEXT nodes with ancestor paths", () => {
    const refs = collectTextRefs(parseMetadataXml(FRAME_METADATA));
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({
      id: "1:11",
      path: ["Login", "Primary CTA"]
    });
  });

  it("tolerates malformed fragments without throwing", () => {
    expect(() => parseMetadataXml("<frame><text id=\"1:1\" name=\"A\" type=\"TEXT\"")).not.toThrow();
  });
});

describe("extractFigmaTextNodesViaMcp", () => {
  const frameScope: FigmaReviewScope = {
    kind: "frame",
    fileKey: "abc123",
    nodeId: "1:10",
    frameName: "Login"
  };

  it("extracts real characters for a frame scope", async () => {
    const result = await extractFigmaTextNodesViaMcp(frameScope, createFakeCaller({}));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.extraction.nodes).toEqual([
      expect.objectContaining({ id: "1:11", characters: "Continue to checkout" }),
      expect.objectContaining({ id: "1:12", characters: "Review your UX copy before publishing." })
    ]);
    expect(result.designContext.hierarchy.length).toBeGreaterThan(0);
  });

  it("extracts flow scopes across metadata calls", async () => {
    const flowScope: FigmaReviewScope = {
      kind: "flow",
      fileKey: "abc123",
      nodeIds: ["2:1", "2:1"],
      flowName: "Onboarding"
    };

    const result = await extractFigmaTextNodesViaMcp(
      flowScope,
      createFakeCaller({ metadata: `${FLOW_METADATA}\n${FLOW_METADATA}` })
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.extraction.nodes.some((node) => node.characters === "Welcome back")).toBe(true);
  });

  it("returns mcp_not_ready when caller is disconnected", async () => {
    const result = await extractFigmaTextNodesViaMcp(
      frameScope,
      createFakeCaller({ status: "disconnected" })
    );

    expect(result).toEqual({
      ok: false,
      diagnostic: expect.objectContaining({ code: "mcp_not_ready" })
    });
  });

  it("degrades per-node failures when read and design context both fail", async () => {
    const result = await extractFigmaTextNodesViaMcp(
      frameScope,
      createFakeCaller({ failReadFor: "1:11", failDesignContextFor: "1:11" })
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.extraction.nodes).toHaveLength(1);
    expect(result.extraction.nodes[0]?.id).toBe("1:12");
  });
});
