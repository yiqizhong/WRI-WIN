import type { ConnectionDiagnostic } from "@writer/contracts";

import type { McpCaller } from "./mcp-caller";
import { mcpNotReadyDiagnostic } from "./mcp-caller";
import { toSurfaceCopy } from "./figma-text-sanitize";
import { extractMcpToolText } from "./mcp-tool-text";

export function buildFigmaTextWriteScript(nodeId: string, characters: string): string {
  return `
const nodeId = ${JSON.stringify(nodeId)};
const characters = ${JSON.stringify(characters)};
const node = await figma.getNodeByIdAsync(nodeId);
if (!node || node.type !== "TEXT") {
  throw new Error("Target node is not TEXT: " + nodeId);
}
const segments = node.getStyledTextSegments(["fontName"]);
for (const segment of segments) {
  await figma.loadFontAsync(segment.fontName);
}
node.characters = characters;
return { mutatedNodeIds: [nodeId] };
`.trim();
}

export type FigmaTextWriteResult =
  | { ok: true; mutatedNodeIds: string[] }
  | { ok: false; diagnostic: ConnectionDiagnostic };

export async function writeFigmaTextNodeViaMcp(
  fileKey: string,
  nodeId: string,
  characters: string,
  mcpCaller: McpCaller
): Promise<FigmaTextWriteResult> {
  if (mcpCaller.status !== "connected") {
    return { ok: false, diagnostic: mcpNotReadyDiagnostic() };
  }

  const sanitized = toSurfaceCopy(characters);

  if (!sanitized) {
    return {
      ok: false,
      diagnostic: {
        code: "smoke_failed",
        severity: "error",
        message: "Writeback text is empty after removing design-to-code boilerplate.",
        recoveryAction: "Re-run audit after reconnecting Figma MCP, then approve and apply again."
      }
    };
  }

  const response = await mcpCaller.callTool("use_figma", {
    fileKey,
    code: buildFigmaTextWriteScript(nodeId, sanitized),
    description: `Update TEXT node ${nodeId} characters for Writer writeback`,
    skillNames: "figma-use"
  });

  if (!response.ok) {
    return {
      ok: false,
      diagnostic: response.diagnostic ?? {
        code: "smoke_failed",
        severity: "error",
        message: "Figma MCP use_figma write failed.",
        recoveryAction: "Check Figma MCP connection and node access."
      }
    };
  }

  const payloadText = extractMcpToolText(response.result);

  if (!payloadText) {
    return {
      ok: false,
      diagnostic: {
        code: "smoke_failed",
        severity: "error",
        message: "Figma MCP use_figma returned no result payload.",
        recoveryAction: "Retry the writeback or reconnect Figma MCP."
      }
    };
  }

  try {
    const parsed = JSON.parse(payloadText) as { mutatedNodeIds?: string[] };

    if (!Array.isArray(parsed.mutatedNodeIds) || parsed.mutatedNodeIds.length === 0) {
      return {
        ok: false,
        diagnostic: {
          code: "smoke_failed",
          severity: "error",
          message: "Figma write did not report mutated node IDs.",
          recoveryAction: "Verify the target node still exists in the file."
        }
      };
    }

    return { ok: true, mutatedNodeIds: parsed.mutatedNodeIds };
  } catch {
    return {
      ok: false,
      diagnostic: {
        code: "smoke_failed",
        severity: "error",
        message: "Figma MCP use_figma returned an unexpected payload.",
        recoveryAction: "Retry the writeback.",
        stderrSnippet: payloadText.slice(0, 240)
      }
    };
  }
}
