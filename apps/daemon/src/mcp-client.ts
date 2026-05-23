import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ConnectionDiagnostic } from "@writer/contracts";

export type McpClientConfig = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
};

export type McpToolSummary = {
  name: string;
  description?: string;
};

export type McpProtocolClient = {
  connect: () => Promise<void>;
  listTools: () => Promise<{ tools: McpToolSummary[] }>;
  callTool: (input: { name: string; arguments?: Record<string, unknown> }) => Promise<unknown>;
  close: () => Promise<void>;
};

export type McpConnectionResult = {
  ok: boolean;
  diagnostic?: ConnectionDiagnostic;
};

export type McpCallToolResult = {
  ok: boolean;
  result?: unknown;
  diagnostic?: ConnectionDiagnostic;
};

export function createMcpClient(
  config: McpClientConfig,
  createProtocolClient: (config: Required<McpClientConfig>) => McpProtocolClient = createSdkProtocolClient
) {
  let protocolClient: McpProtocolClient | null = null;

  return {
    async connect(): Promise<McpConnectionResult> {
      if (!config.command) {
        return {
          ok: false,
          diagnostic: {
            code: "not_configured",
            severity: "warning",
            message: "Figma MCP command is not configured.",
            recoveryAction: "Set WRITER_FIGMA_MCP_COMMAND and optional WRITER_FIGMA_MCP_ARGS."
          }
        };
      }

      try {
        protocolClient = createProtocolClient({
          command: config.command,
          args: config.args ?? [],
          env: config.env ?? {}
        });
        await protocolClient.connect();
        return { ok: true };
      } catch (error) {
        protocolClient = null;
        const message = error instanceof Error ? error.message : "MCP server failed to start.";
        return {
          ok: false,
          diagnostic: {
            code: "startup_failed",
            severity: "error",
            message: "Figma MCP server failed to start or initialize.",
            recoveryAction: "Check the configured MCP command, args, token, and server logs.",
            command: config.command,
            stderrSnippet: message
          }
        };
      }
    },

    async listTools(): Promise<McpToolSummary[]> {
      if (!protocolClient) {
        return [];
      }

      const result = await protocolClient.listTools();
      return result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description
      }));
    },

    async callTool(name: string, args: Record<string, unknown>): Promise<McpCallToolResult> {
      if (!protocolClient) {
        return {
          ok: false,
          diagnostic: {
            code: "startup_failed",
            severity: "error",
            message: "Figma MCP server is not connected.",
            recoveryAction: "Enable and test the Figma MCP server before calling tools.",
            command: config.command
          }
        };
      }

      try {
        return {
          ok: true,
          result: await protocolClient.callTool({ name, arguments: args })
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "MCP tool call failed.";
        return {
          ok: false,
          diagnostic: {
            code: "smoke_failed",
            severity: "error",
            message: `Figma MCP tool ${name} failed.`,
            recoveryAction: "Check Figma MCP authentication, file access, and tool arguments.",
            command: config.command,
            stderrSnippet: message
          }
        };
      }
    },

    async close(): Promise<void> {
      await protocolClient?.close();
      protocolClient = null;
    }
  };
}

function createSdkProtocolClient(config: Required<McpClientConfig>): McpProtocolClient {
  const client = new Client({ name: "writer-daemon", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: { ...process.env, ...config.env } as Record<string, string>,
    stderr: "pipe"
  });

  return {
    connect: () => client.connect(transport),
    listTools: () => client.listTools(),
    callTool: (input) => client.callTool(input),
    close: () => client.close()
  };
}
