import { describe, expect, it } from "vitest";

import { commandExists, runCliCommand } from "./cli-runner";

describe("cli-runner", () => {
  it("finds echo on macOS/linux", async () => {
    const path = await commandExists("echo");
    expect(path).toBeTruthy();
  });

  it("runs a short command with timeout", async () => {
    const result = await runCliCommand({
      executable: "/bin/echo",
      args: ["hello"],
      timeoutMs: 5_000
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
  });

  it("preserves spawn ENOENT details", async () => {
    const result = await runCliCommand({
      executable: "/definitely/missing/writer-cli",
      args: ["--version"],
      timeoutMs: 1_000
    });

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("ENOENT");
    expect(result.spawnError).toContain("ENOENT");
  });
});
