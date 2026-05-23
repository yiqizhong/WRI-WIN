import { describe, expect, it } from "vitest";

import {
  formatConnectionDiagnostic,
  formatConnectionDiagnosticTechnical,
  mcpConnectionStatusLabel,
  mcpConnectionStatusTagType,
  summarizeMcpTools
} from "./connection-diagnostics";

describe("connection diagnostic display helpers", () => {
  it("formats user-facing diagnostic message and recovery action", () => {
    expect(
      formatConnectionDiagnostic({
        code: "broken_executable",
        severity: "error",
        message: "Codex wrapper found but vendor binary is missing.",
        recoveryAction: "Reinstall Codex.",
        command: "/opt/homebrew/bin/codex"
      })
    ).toBe("Codex wrapper found but vendor binary is missing. Reinstall Codex.");
  });

  it("formats technical diagnostic details for logs", () => {
    expect(
      formatConnectionDiagnosticTechnical({
        code: "broken_executable",
        severity: "error",
        message: "Codex wrapper found but vendor binary is missing.",
        recoveryAction: "Reinstall Codex.",
        command: "/opt/homebrew/bin/codex"
      })
    ).toBe(
      "broken_executable · Codex wrapper found but vendor binary is missing. Recovery: Reinstall Codex. Command: /opt/homebrew/bin/codex"
    );
  });

  it("maps MCP connection status to labels and tag tones", () => {
    expect(mcpConnectionStatusLabel("connected")).toBe("Connected");
    expect(mcpConnectionStatusLabel("connecting")).toBe("Connecting");
    expect(mcpConnectionStatusTagType("disconnected")).toBe("gray");
    expect(mcpConnectionStatusTagType("error")).toBe("red");
  });

  it("summarizes discovered MCP tools", () => {
    expect(summarizeMcpTools([{ name: "figma_get_file" }, { name: "write_comment" }])).toBe(
      "figma_get_file, write_comment"
    );
  });
});
