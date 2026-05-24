import { describe, expect, it } from "vitest";

import {
  connectionDiagnosticSchema,
  parseConnectionDiagnostic,
  redactDiagnosticMetadata
} from "./connection-diagnostic";

describe("connection diagnostics", () => {
  it("parses actionable runtime connection failures", () => {
    const diagnostic = parseConnectionDiagnostic({
      code: "broken_executable",
      severity: "error",
      message: "Codex wrapper found but vendor binary is missing.",
      recoveryAction: "Reinstall the Codex CLI.",
      command: "/opt/homebrew/bin/codex",
      exitCode: 1,
      stderrSnippet: "spawn vendor/codex ENOENT",
      metadata: {
        provider: "codex"
      }
    });

    expect(diagnostic.code).toBe("broken_executable");
    expect(diagnostic.command).toBe("/opt/homebrew/bin/codex");
    expect(diagnostic.metadata).toEqual({ provider: "codex" });
  });

  it("supports the connection states used by CLI and MCP runtimes", () => {
    const codes = [
      "missing_command",
      "broken_executable",
      "version_probe_failed",
      "needs_auth",
      "timeout",
      "smoke_failed",
      "not_configured",
      "startup_failed",
      "tool_not_found",
      "mcp_not_ready",
      "unsupported_figma_source",
      "unsupported_source",
      "partial_read_failure",
      "write_conflict",
      "write_failed",
      "ready"
    ];

    for (const code of codes) {
      expect(() =>
        connectionDiagnosticSchema.parse({
          code,
          severity: code === "ready" ? "info" : "error",
          message: `${code} message`
        })
      ).not.toThrow();
    }
  });

  it("redacts secret-like diagnostic metadata before display", () => {
    const redacted = redactDiagnosticMetadata({
      FIGMA_ACCESS_TOKEN: "secret-token",
      apiKey: "secret-api-key",
      command: "figma-mcp",
      nested: {
        token: "nested-secret",
        safe: "value"
      }
    });

    expect(redacted).toEqual({
      FIGMA_ACCESS_TOKEN: "[redacted]",
      apiKey: "[redacted]",
      command: "figma-mcp",
      nested: {
        token: "[redacted]",
        safe: "value"
      }
    });
  });
});
