import { describe, expect, it } from "vitest";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { detectCliAdapter } from "./create-cli-adapter";

describe("detectCliAdapter", () => {
  it("marks missing command as unavailable", async () => {
    const result = await detectCliAdapter({
      id: "missing-cli",
      displayName: "Missing",
      runtimeKind: "local",
      command: "writer-missing-cli-xyz",
      unavailableMessage: "Install missing CLI.",
      buildRunArgs: (prompt) => [prompt]
    });

    expect(result.adapter.available).toBe(false);
    expect(result.adapter.setupMessage).toContain("Install missing CLI");
    expect(result.adapter.diagnostic?.code).toBe("missing_command");
  });

  it("classifies a found wrapper with missing vendor binary as broken executable", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "writer-cli-adapter-"));
    const commandPath = join(binDir, "broken-codex");
    await writeFile(
      commandPath,
      [
        "#!/usr/bin/env bash",
        "echo \"Error: spawn vendor/aarch64-apple-darwin/codex ENOENT\" >&2",
        "exit 1"
      ].join("\n")
    );
    await chmod(commandPath, 0o755);

    const previousPath = process.env.PATH;
    process.env.PATH = `${binDir}:${previousPath ?? ""}`;
    try {
      const result = await detectCliAdapter({
        id: "codex",
        displayName: "Codex",
        runtimeKind: "local",
        command: "broken-codex",
        detectArgs: ["--version"],
        unavailableMessage: "Install OpenAI Codex CLI and ensure codex is on your PATH.",
        buildRunArgs: (prompt) => [prompt]
      });

      expect(result.adapter.available).toBe(false);
      expect(result.adapter.executablePath).toBe(commandPath);
      expect(result.adapter.diagnostic?.code).toBe("broken_executable");
      expect(result.adapter.diagnostic?.stderrSnippet).toContain("ENOENT");
      expect(result.adapter.diagnostic?.recoveryAction).toContain("Reinstall");
    } finally {
      process.env.PATH = previousPath;
    }
  });
});
