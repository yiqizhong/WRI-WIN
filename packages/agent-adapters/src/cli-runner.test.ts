import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { commandExists, runCliCommand } from "./cli-runner";

const isWindows = platform() === "win32";

describe("cli-runner", () => {
  it("resolves a command that exists on the current platform", async () => {
    // A command guaranteed to be present on each OS. On Windows this fails
    // before the fix because commandExists hardcodes the Unix `/usr/bin/which`,
    // which does not exist there.
    const knownCommand = isWindows ? "where" : "sh";
    const path = await commandExists(knownCommand);
    expect(path).toBeTruthy();
  });

  it("returns null for a command that is not on PATH", async () => {
    const path = await commandExists("writer-definitely-missing-cli");
    expect(path).toBeNull();
  });

  it("runs a short command with timeout", async () => {
    const result = isWindows
      ? await runCliCommand({
          executable: "cmd",
          args: ["/c", "echo", "hello"],
          timeoutMs: 5_000
        })
      : await runCliCommand({
          executable: "/bin/echo",
          args: ["hello"],
          timeoutMs: 5_000
        });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello");
  });

  it("runs a script CLI wrapper resolved by full path", async () => {
    // Windows agent CLIs (codex, cursor-agent, claude) install as `.cmd`
    // shims. node spawn cannot launch a .cmd directly — it must go through the
    // shell — so before the fix this fails with EINVAL. On Unix the equivalent
    // is a chmod +x shell script, which spawns fine either way.
    const binDir = await mkdtemp(join(tmpdir(), "writer-cli-script-"));
    let scriptPath: string;
    if (isWindows) {
      scriptPath = join(binDir, "wrapper.cmd");
      await writeFile(scriptPath, ["@echo off", "echo wrapper-ok"].join("\r\n"));
    } else {
      scriptPath = join(binDir, "wrapper");
      await writeFile(scriptPath, ["#!/usr/bin/env bash", "echo wrapper-ok"].join("\n"));
      await chmod(scriptPath, 0o755);
    }

    const result = await runCliCommand({
      executable: scriptPath,
      args: [],
      timeoutMs: 5_000
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("wrapper-ok");
  });

  it("passes metacharacter args to a .cmd wrapper literally (no shell injection)", async () => {
    // Windows `.cmd` shims must run without letting prompt content break out
    // into the shell. The arg below contains `&` and `|`; an injection would
    // run `whoami`/`echo PWNED`. We assert the wrapper received the raw text
    // and that no injected output appears.
    if (!isWindows) {
      return;
    }

    const binDir = await mkdtemp(join(tmpdir(), "writer-cli-inject-"));
    const scriptPath = join(binDir, "echoarg.cmd");
    // %~1 echoes the first arg with surrounding quotes stripped.
    await writeFile(scriptPath, ["@echo off", "echo ARG=%~1"].join("\r\n"));

    const evil = "review this & whoami | echo INJECTED";
    const result = await runCliCommand({
      executable: scriptPath,
      args: [evil],
      timeoutMs: 5_000
    });

    expect(result.exitCode).toBe(0);
    // The whole arg comes back on the ARG= line, untouched.
    expect(result.stdout).toContain(`ARG=${evil}`);
    // If `& ... | echo INJECTED` had executed, "INJECTED" would appear on its
    // own output line. It must only ever appear inside the echoed ARG= line.
    const injectedOnOwnLine = result.stdout
      .split(/\r?\n/)
      .some((line) => line.trim() === "INJECTED");
    expect(injectedOnOwnLine).toBe(false);
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
