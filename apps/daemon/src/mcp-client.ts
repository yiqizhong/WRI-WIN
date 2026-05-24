import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { ConnectionDiagnostic, McpCallToolResult } from "@writer/contracts";

export type McpClientConfig = {
  transport?: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  authProvider?: OAuthClientProvider;
};

type NormalizedMcpClientConfig = McpClientConfig & {
  transport: "stdio" | "http";
  args: string[];
  env: Record<string, string>;
  headers: Record<string, string>;
};

export type McpToolSummary = {
  name: string;
  description?: string;
};

export type McpProtocolClient = {
  connect: () => Promise<void>;
  listTools: () => Promise<{ tools: McpToolSummary[] }>;
  callTool: (input: { name: string; arguments?: Record<string, unknown> }) => Promise<unknown>;
  finishAuth?: (authorizationCode: string) => Promise<void>;
  close: () => Promise<void>;
};

export type McpConnectionResult = {
  ok: boolean;
  diagnostic?: ConnectionDiagnostic;
};

export type { McpCallToolResult };

export function createMcpClient(
  config: McpClientConfig,
  createProtocolClient: (config: NormalizedMcpClientConfig) => McpProtocolClient = createSdkProtocolClient
) {
  let protocolClient: McpProtocolClient | null = null;
  const normalizedConfig = normalizeMcpClientConfig(config);

  return {
    async connect(): Promise<McpConnectionResult> {
      if (normalizedConfig.transport === "stdio" && !normalizedConfig.command) {
        return notConfiguredDiagnostic();
      }

      if (normalizedConfig.transport === "http" && !normalizedConfig.url) {
        return notConfiguredDiagnostic();
      }

      if (normalizedConfig.transport === "http" && normalizedConfig.url) {
        try {
          new URL(normalizedConfig.url);
        } catch {
          return {
            ok: false,
            diagnostic: {
              code: "not_configured",
              severity: "error",
              message: "Figma MCP remote URL is invalid.",
              recoveryAction: "Set WRITER_FIGMA_MCP_URL to a valid MCP endpoint URL.",
              command: normalizedConfig.url
            }
          };
        }
      }

      try {
        protocolClient = createProtocolClient(normalizedConfig);
        await protocolClient.connect();
        return { ok: true };
      } catch (error) {
        if (!isAuthRequiredError(error)) {
          protocolClient = null;
        }

        if (isAuthRequiredError(error)) {
          return {
            ok: false,
            diagnostic: {
              code: "needs_auth",
              severity: "warning",
              message: "Figma MCP requires sign-in.",
              recoveryAction: "Click Connect Figma in Writer to sign in with your Figma account.",
              command: normalizedConfig.url ?? normalizedConfig.command
            }
          };
        }

        const message = error instanceof Error ? error.message : "MCP server failed to start.";
        return {
          ok: false,
          diagnostic: {
            code: "startup_failed",
            severity: "error",
            message: "Figma MCP server failed to start or initialize.",
            recoveryAction:
              normalizedConfig.transport === "http"
                ? "Check the configured MCP URL and remote server authentication."
                : "Check the configured MCP command, args, token, and server logs.",
            command: normalizedConfig.url ?? normalizedConfig.command,
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
            command: normalizedConfig.url ?? normalizedConfig.command
          }
        };
      }

      try {
        const result = await protocolClient.callTool({ name, arguments: args });
        const toolError = getMcpToolErrorMessage(result);

        if (toolError) {
          return {
            ok: false,
            result,
            diagnostic: {
              code: "smoke_failed",
              severity: "error",
              message: `Figma MCP tool ${name} returned an error.`,
              recoveryAction: "Check tool arguments and Figma file access.",
              command: normalizedConfig.url ?? normalizedConfig.command,
              stderrSnippet: toolError
            }
          };
        }

        return {
          ok: true,
          result
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
            command: normalizedConfig.url ?? normalizedConfig.command,
            stderrSnippet: message
          }
        };
      }
    },

    async finishAuth(authorizationCode: string): Promise<McpConnectionResult> {
      if (!protocolClient?.finishAuth) {
        return {
          ok: false,
          diagnostic: {
            code: "needs_auth",
            severity: "warning",
            message: "Figma MCP OAuth is not available for this transport.",
            recoveryAction: "Use the remote Figma MCP URL or click Connect Figma."
          }
        };
      }

      try {
        await protocolClient.finishAuth(authorizationCode);
        await protocolClient.connect();
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Figma OAuth failed.";
        return {
          ok: false,
          diagnostic: {
            code: "smoke_failed",
            severity: "error",
            message: "Figma OAuth callback failed.",
            recoveryAction: "Try Connect Figma again.",
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

function createSdkProtocolClient(config: NormalizedMcpClientConfig): McpProtocolClient {
  const client = new Client({ name: "writer-daemon", version: "0.1.0" });
  const transport =
    config.transport === "http" && config.url
      ? new StreamableHTTPClientTransport(new URL(config.url), {
          authProvider: config.authProvider,
          requestInit: Object.keys(config.headers).length > 0 ? { headers: config.headers } : undefined
        })
      : new StdioClientTransport({
          command: config.command ?? "",
          args: config.args,
          env: { ...process.env, ...config.env } as Record<string, string>,
          stderr: "pipe"
        });

  return {
    connect: () => client.connect(transport),
    listTools: () => client.listTools(),
    callTool: (input) => client.callTool(input),
    finishAuth:
      transport instanceof StreamableHTTPClientTransport
        ? (authorizationCode) => transport.finishAuth(authorizationCode)
        : undefined,
    close: () => client.close()
  };
}

function isAuthRequiredError(error: unknown): boolean {
  if (error instanceof UnauthorizedError) {
    return true;
  }

  if (error instanceof StreamableHTTPError && error.code === 401) {
    return true;
  }

  if (error instanceof Error && /unauthorized/i.test(error.message)) {
    return true;
  }

  return false;
}

function normalizeMcpClientConfig(config: McpClientConfig): NormalizedMcpClientConfig {
  return {
    ...config,
    transport: config.transport ?? (config.url ? "http" : "stdio"),
    args: config.args ?? [],
    env: config.env ?? {},
    headers: config.headers ?? {}
  };
}

function getMcpToolErrorMessage(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const record = result as Record<string, unknown>;

  if (record.isError === true) {
    return extractMcpContentText(record.content) ?? "MCP tool reported isError=true.";
  }

  const contentText = extractMcpContentText(record.content);
  if (contentText && /^MCP error\b/i.test(contentText)) {
    return contentText;
  }

  return undefined;
}

function extractMcpContentText(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const text = content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      const entry = item as Record<string, unknown>;
      return entry.type === "text" && typeof entry.text === "string" ? entry.text : "";
    })
    .join("\n")
    .trim();

  return text || undefined;
}

function notConfiguredDiagnostic(): McpConnectionResult {
  return {
    ok: false,
    diagnostic: {
      code: "not_configured",
      severity: "warning",
      message: "Figma MCP is not configured.",
      recoveryAction: "Set WRITER_FIGMA_MCP_URL for remote HTTP, or WRITER_FIGMA_MCP_COMMAND and optional WRITER_FIGMA_MCP_ARGS for stdio."
    }
  };
}
