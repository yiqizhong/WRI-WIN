import type { ConnectionDiagnostic, DesignContext, FigmaTextExtraction, McpCallToolResult } from "@writer/contracts";

export type McpCallerStatus = "connected" | "disconnected" | "error";

export interface McpCaller {
  callTool(name: string, args: Record<string, unknown>): Promise<McpCallToolResult>;
  status: McpCallerStatus;
}

export type FigmaExtractionSuccess = {
  ok: true;
  extraction: FigmaTextExtraction;
  designContext: DesignContext;
  metadataXml: string;
};

export type FigmaExtractionFailure = {
  ok: false;
  diagnostic: ConnectionDiagnostic;
};

export type FigmaExtractionResult = FigmaExtractionSuccess | FigmaExtractionFailure;

export function mcpNotReadyDiagnostic(): ConnectionDiagnostic {
  return {
    code: "mcp_not_ready",
    severity: "warning",
    message: "Figma MCP is not connected.",
    recoveryAction: "Open Agents and connect Figma MCP, then run the audit again."
  };
}

export function unsupportedFigmaScopeDiagnostic(message: string, recoveryAction: string): ConnectionDiagnostic {
  return {
    code: "unsupported_figma_source",
    severity: "warning",
    message,
    recoveryAction
  };
}
