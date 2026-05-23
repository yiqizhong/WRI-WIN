import { describe, expect, it } from "vitest";

import { formatConnectionDiagnostic, summarizeMcpTools } from "./connection-diagnostics";

describe("connection diagnostic display helpers", () => {
  it("formats diagnostic message and recovery action", () => {
    expect(
      formatConnectionDiagnostic({
        code: "broken_executable",
        severity: "error",
        message: "Codex wrapper found but vendor binary is missing.",
        recoveryAction: "Reinstall Codex.",
        command: "/opt/homebrew/bin/codex"
      })
    ).toBe("broken_executable · Codex wrapper found but vendor binary is missing. Recovery: Reinstall Codex. Command: /opt/homebrew/bin/codex");
  });

  it("summarizes discovered MCP tools", () => {
    expect(summarizeMcpTools([{ name: "figma_get_file" }, { name: "write_comment" }])).toBe(
      "figma_get_file, write_comment"
    );
  });
});
