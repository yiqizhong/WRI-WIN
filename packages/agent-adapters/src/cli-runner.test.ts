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
});
