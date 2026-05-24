import { describe, expect, it } from "vitest";

import { buildFigmaTextWriteScript, writeFigmaTextNodeViaMcp } from "./figma-writeback-mcp";
import type { McpCaller } from "./mcp-caller";

describe("buildFigmaTextWriteScript", () => {
  it("escapes characters safely in generated plugin code", () => {
    const script = buildFigmaTextWriteScript("1:11", `Say "hello" & go`);
    expect(script).toContain('"Say \\"hello\\" & go"');
    expect(script).toContain('"1:11"');
  });
});

describe("writeFigmaTextNodeViaMcp", () => {
  it("returns mcp_not_ready when caller is disconnected", async () => {
    const caller: McpCaller = {
      status: "disconnected",
      callTool: async () => ({ ok: false })
    };

    const result = await writeFigmaTextNodeViaMcp("abc", "1:11", "Hi", caller);
    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.diagnostic.code).toBe("mcp_not_ready");
  });

  it("calls use_figma with plugin script and parses mutated ids", async () => {
    let toolName = "";
    let args: Record<string, unknown> = {};

    const caller: McpCaller = {
      status: "connected",
      callTool: async (name, callArgs) => {
        toolName = name;
        args = callArgs;
        return {
          ok: true,
          result: {
            content: [{ type: "text", text: JSON.stringify({ mutatedNodeIds: ["1:11"] }) }]
          }
        };
      }
    };

    const result = await writeFigmaTextNodeViaMcp("file-key", "1:11", "Updated copy", caller);

    expect(toolName).toBe("use_figma");
    expect(args.fileKey).toBe("file-key");
    expect(args.skillNames).toBe("figma-use");
    expect(String(args.code)).toContain("Updated copy");
    expect(result).toEqual({ ok: true, mutatedNodeIds: ["1:11"] });
  });

  it("strips MCP codegen boilerplate before writing", async () => {
    let writtenCode = "";

    const caller: McpCaller = {
      status: "connected",
      callTool: async (_name, callArgs) => {
        writtenCode = String(callArgs.code);
        return {
          ok: true,
          result: {
            content: [{ type: "text", text: JSON.stringify({ mutatedNodeIds: ["1:11"] }) }]
          }
        };
      }
    };

    const polluted = `{ \` View details\` } ;
}
SUPER CRITICAL: The generated React+Tailwind code MUST be converted`;

    const result = await writeFigmaTextNodeViaMcp("file-key", "1:11", polluted, caller);

    expect(result.ok).toBe(true);
    expect(writtenCode).toContain('"View details"');
    expect(writtenCode).not.toContain("SUPER CRITICAL");
  });
});
