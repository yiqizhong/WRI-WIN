import { describe, expect, it } from "vitest";

import type { FigmaReviewScope } from "@writer/contracts";

import { extractFigmaTextNodesViaMcp } from "./figma-extract-mcp";
import { collectTextRefs, findMetadataNodeById, parseMetadataXml } from "./figma-metadata-xml";
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

type FakeCallerOptions = {
  status?: McpCaller["status"];
  metadata?: string;
  designContextByNode?: Record<string, string>;
  failDesignContextFor?: string;
  failReadFor?: string;
  /** Nodes returned by the frame scan (use_figma with `return { texts }`). */
  scannedTextNodes?: Array<{ id: string; name: string; characters: string; path: string[]; visible: boolean }>;
};

function createFakeCaller(options: FakeCallerOptions): McpCaller {
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

      if (name === "use_figma" && String(args.code).includes("return { texts }")) {
        const texts = options.scannedTextNodes ?? [];
        return {
          ok: true,
          result: { content: [{ type: "text", text: JSON.stringify({ texts }) }] }
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

// Real Figma MCP returns all elements with the same <node> tag, differentiated
// only by the `type` attribute. Naive indexOf("</node>") finds the FIRST closing
// tag rather than the matching one, so TEXT siblings after any non-self-closing
// sibling are silently dropped.
const UNIFORM_TAG_METADATA = `
<node id="88:1" name="88" type="FRAME">
  <node id="88:2" name="Background" type="RECTANGLE"></node>
  <node id="88:3" name="Title" type="TEXT"></node>
  <node id="88:4" name="Group" type="GROUP">
    <node id="88:5" name="Subtitle" type="TEXT"></node>
  </node>
</node>
`;

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

  it("finds a node by id in parsed metadata", () => {
    const nodes = parseMetadataXml(FRAME_METADATA);
    expect(findMetadataNodeById(nodes, "1:11")?.name).toBe("Primary CTA");
    expect(findMetadataNodeById(nodes, "missing")).toBeUndefined();
  });

  it("collects TEXT nodes when all elements share the same tag name (real Figma MCP format)", () => {
    const refs = collectTextRefs(parseMetadataXml(UNIFORM_TAG_METADATA));
    const ids = refs.map((r) => r.id);
    expect(ids).toContain("88:3");
    expect(ids).toContain("88:5");
    expect(refs).toHaveLength(2);
  });

  it("preserves sibling TEXT nodes after a non-self-closing sibling", () => {
    const xml = `
<node id="1:1" name="Frame" type="FRAME">
  <node id="1:2" name="Rect" type="RECTANGLE"></node>
  <node id="1:3" name="Label" type="TEXT"></node>
</node>
`;
    const refs = collectTextRefs(parseMetadataXml(xml));
    expect(refs.map((r) => r.id)).toContain("1:3");
  });

  it("places TEXT nodes as children of the correct parent (hierarchy correctness)", () => {
    // 88:3 should be a direct child of 88:1, and 88:5 a child of 88:4.
    // Without depth-aware closing tag matching the parser promotes them
    // to root level, breaking path resolution and findMetadataNodeById subtree search.
    const nodes = parseMetadataXml(UNIFORM_TAG_METADATA);
    const frame = findMetadataNodeById(nodes, "88:1");
    expect(frame).toBeDefined();
    const childIds = frame!.children.map((c) => c.id);
    expect(childIds).toContain("88:3");
    expect(childIds).toContain("88:4");
    const group = frame!.children.find((c) => c.id === "88:4");
    expect(group?.children.map((c) => c.id)).toContain("88:5");
  });

  it("records correct ancestor path for nested TEXT nodes", () => {
    const refs = collectTextRefs(parseMetadataXml(UNIFORM_TAG_METADATA));
    const subtitle = refs.find((r) => r.id === "88:5");
    expect(subtitle?.path).toEqual(["88", "Group", "Subtitle"]);
  });
});

function makeMetadata(count: number): string {
  const nodes = Array.from(
    { length: count },
    (_, i) => `<text id="t:${i}" name="Node${i}" type="TEXT" visible="true" />`
  ).join("\n");
  return `<frame id="1:10" name="Login" type="FRAME">\n${nodes}\n</frame>`;
}

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

  it("falls back to TEXT layer name when MCP read and design context fail", async () => {
    const metadata = `
<frame id="1:10" name="Login" type="FRAME">
  <text id="1:11" name="Save your work" type="TEXT" visible="true" />
</frame>
`;
    const result = await extractFigmaTextNodesViaMcp(
      frameScope,
      createFakeCaller({
        metadata,
        failReadFor: "1:11",
        failDesignContextFor: "1:11"
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.nodes).toEqual([
      expect.objectContaining({ id: "1:11", characters: "Save your work" })
    ]);
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

  it("includes empty TEXT layers when MCP returns blank characters", async () => {
    const metadata = `
<frame id="1:10" name="Login" type="FRAME">
  <text id="1:11" name="Optional note" type="TEXT" visible="true" />
</frame>
`;
    const result = await extractFigmaTextNodesViaMcp(
      frameScope,
      createFakeCaller({
        metadata,
        designContextByNode: { "1:11": "" }
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.extraction.nodes).toEqual([
      expect.objectContaining({ id: "1:11", characters: "" })
    ]);
  });

  it("uses layer name fallback when read and design context both fail", async () => {
    const result = await extractFigmaTextNodesViaMcp(
      frameScope,
      createFakeCaller({ failReadFor: "1:11", failDesignContextFor: "1:11" })
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.extraction.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "1:11", characters: "Primary CTA" }),
        expect.objectContaining({ id: "1:12" })
      ])
    );
  });

  it("extracts TEXT nodes inside component instances (not exposed by get_metadata XML)", async () => {
    // Simulates a Figma frame where get_metadata only returns the INSTANCE node
    // as a leaf — the text nodes inside it are absent from the XML.
    const metadata = `
<node id="1:10" name="Login" type="FRAME">
  <node id="1:20" name="Card" type="INSTANCE"></node>
</node>
`;
    const scannedTextNodes = [
      { id: "I1:20;5:1", name: "Heading", characters: "Sign in", path: ["Login", "Card", "Heading"], visible: true },
      { id: "I1:20;5:2", name: "Subtext", characters: "Enter your details", path: ["Login", "Card", "Subtext"], visible: true }
    ];

    const result = await extractFigmaTextNodesViaMcp(
      frameScope,
      createFakeCaller({
        metadata,
        scannedTextNodes,
        designContextByNode: {
          "I1:20;5:1": "Sign in",
          "I1:20;5:2": "Enter your details"
        }
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.extraction.nodes.map((n) => n.id);
    expect(ids).toContain("I1:20;5:1");
    expect(ids).toContain("I1:20;5:2");

    const heading = result.extraction.nodes.find((n) => n.id === "I1:20;5:1");
    expect(heading?.characters).toBe("Sign in");
  });

  it("caps extraction at 500 nodes and adds a warning when 600 refs are present", async () => {
    const result = await extractFigmaTextNodesViaMcp(
      frameScope,
      createFakeCaller({ metadata: makeMetadata(600) })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.extraction.nodes.length).toBe(500);
    expect(result.extraction.warnings.length).toBeGreaterThan(0);
    expect(result.extraction.warnings[0].message).toMatch(/500 of 600.*skipped/);
  });

  it("returns all 300 nodes and no warnings when under the cap", async () => {
    const result = await extractFigmaTextNodesViaMcp(
      frameScope,
      createFakeCaller({ metadata: makeMetadata(300) })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.extraction.nodes.length).toBe(300);
    expect(result.extraction.warnings).toHaveLength(0);
  });

  it("processes 10 refs with peak concurrency never exceeding 8 and returns results in original order", async () => {
    // Build metadata with 10 text nodes
    const metadata = makeMetadata(10);

    let inFlight = 0;
    let peakConcurrency = 0;

    const fakeCaller: McpCaller = {
      status: "connected",
      callTool: async (name, args) => {
        if (name === "get_metadata") {
          return {
            ok: true,
            result: { content: [{ type: "text", text: metadata }] }
          };
        }

        if (name === "use_figma" && String(args.code).includes("return { texts }")) {
          return {
            ok: true,
            result: { content: [{ type: "text", text: JSON.stringify({ texts: [] }) }] }
          };
        }

        if (name === "use_figma" && String(args.code).includes("return { nodeId")) {
          inFlight++;
          peakConcurrency = Math.max(peakConcurrency, inFlight);
          await new Promise<void>((r) => setTimeout(r, 10));
          inFlight--;

          const nodeIdMatch = String(args.code).match(/nodeId = "([^"]+)"/);
          const nodeId = nodeIdMatch?.[1] ?? "";
          const characters = `text-for-${nodeId}`;
          return {
            ok: true,
            result: { content: [{ type: "text", text: JSON.stringify({ nodeId, characters }) }] }
          };
        }

        if (name === "get_design_context") {
          const nodeId = String(args.nodeId ?? "");
          return {
            ok: true,
            result: { content: [{ type: "text", text: `<span>${nodeId}</span>` }] }
          };
        }

        return { ok: false };
      }
    };

    const result = await extractFigmaTextNodesViaMcp(frameScope, fakeCaller);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // All 10 results returned
    expect(result.extraction.nodes).toHaveLength(10);

    // Peak concurrency must not exceed 8, and must have actually run concurrently
    expect(peakConcurrency).toBeLessThanOrEqual(8);
    expect(peakConcurrency).toBeGreaterThanOrEqual(2);

    // Results must be in original order (node IDs match metadata order: t:0..t:9)
    const ids = result.extraction.nodes.map((n) => n.id);
    expect(ids).toEqual(["t:0", "t:1", "t:2", "t:3", "t:4", "t:5", "t:6", "t:7", "t:8", "t:9"]);
  });

  it("produces a fallback node for a failing ref and resolves all other refs", async () => {
    // Node "t:3" will fail both read and design context, falling back to its name
    const metadata = makeMetadata(5);
    const FAILING_ID = "t:3";

    const result = await extractFigmaTextNodesViaMcp(
      frameScope,
      createFakeCaller({
        metadata,
        failReadFor: FAILING_ID,
        failDesignContextFor: FAILING_ID,
        designContextByNode: {
          "t:0": "text zero",
          "t:1": "text one",
          "t:2": "text two",
          // t:3 intentionally omitted — will fail
          "t:4": "text four"
        }
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // All 5 nodes returned
    expect(result.extraction.nodes).toHaveLength(5);

    // The failing node falls back to its name ("Node3")
    const failingNode = result.extraction.nodes.find((n) => n.id === FAILING_ID);
    expect(failingNode).toBeDefined();
    expect(failingNode?.characters).toBe("Node3");

    // All other nodes still resolve normally
    expect(result.extraction.nodes.find((n) => n.id === "t:0")?.characters).toBe("text zero");
    expect(result.extraction.nodes.find((n) => n.id === "t:4")?.characters).toBe("text four");
  });
});
