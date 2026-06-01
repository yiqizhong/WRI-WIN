import { afterEach, describe, expect, it } from "vitest";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { basename, delimiter, join } from "node:path";
import { platform, tmpdir } from "node:os";

import { clearAdapterDetectionCache, detectCliAdapter } from "./create-cli-adapter";

const isWindows = platform() === "win32";

/**
 * Writes a fake CLI executable that `where`/`which` can resolve by bare name,
 * and prepends its directory to PATH. Returns the resolved command path and a
 * cleanup that restores PATH. Cross-platform: a `.cmd` batch file on Windows,
 * a chmod +x bash script elsewhere.
 */
async function installFakeCli(
  prefix: string,
  name: string,
  body: { bash: string[]; batch: string[] }
): Promise<{ commandPath: string; restorePath: () => void }> {
  const binDir = await mkdtemp(join(tmpdir(), prefix));
  const commandPath = isWindows ? join(binDir, `${name}.cmd`) : join(binDir, name);

  if (isWindows) {
    await writeFile(commandPath, ["@echo off", ...body.batch].join("\r\n"));
  } else {
    await writeFile(commandPath, ["#!/usr/bin/env bash", ...body.bash].join("\n"));
    await chmod(commandPath, 0o755);
  }

  const previousPath = process.env.PATH;
  process.env.PATH = `${binDir}${delimiter}${previousPath ?? ""}`;
  return {
    commandPath,
    restorePath: () => {
      process.env.PATH = previousPath;
    }
  };
}

describe("detectCliAdapter", () => {
  afterEach(() => {
    clearAdapterDetectionCache();
  });

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
    const { commandPath, restorePath } = await installFakeCli("writer-cli-adapter-", "broken-codex", {
      bash: ["echo \"Error: spawn vendor/aarch64-apple-darwin/codex ENOENT\" >&2", "exit 1"],
      batch: ["echo Error: spawn vendor/x86_64-pc-windows/codex ENOENT 1>&2", "exit /b 1"]
    });

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
      // `where`/`which` may return a normalized (e.g. Windows long-form) path,
      // so match the resolved basename rather than the raw fixture string.
      expect(result.adapter.executablePath).toBeTruthy();
      expect(result.adapter.executablePath?.toLowerCase()).toContain(
        basename(commandPath).toLowerCase()
      );
      expect(result.adapter.diagnostic?.code).toBe("broken_executable");
      expect(result.adapter.diagnostic?.stderrSnippet).toContain("ENOENT");
      expect(result.adapter.diagnostic?.recoveryAction).toContain("Reinstall");
    } finally {
      restorePath();
    }
  });

  it("caches successful detections so a second call within TTL returns the same object", async () => {
    // A trivial available "CLI" that just exits 0 on --version.
    const { restorePath } = await installFakeCli("writer-cli-cache-", "fake-cli", {
      bash: ["echo v1", "exit 0"],
      batch: ["echo v1", "exit /b 0"]
    });

    try {
      const config = {
        id: "fake-cli-cache",
        displayName: "Fake CLI",
        runtimeKind: "local" as const,
        command: "fake-cli",
        detectArgs: ["--version"],
        unavailableMessage: "Install Fake CLI.",
        buildRunArgs: (prompt: string) => [prompt]
      };

      const first = await detectCliAdapter(config);
      const second = await detectCliAdapter(config);

      // Reference equality proves the cached object — and therefore no
      // second subprocess spawn — was returned. This is the property the
      // TTFT fix depends on.
      expect(second).toBe(first);
      expect(second.adapter.available).toBe(true);
    } finally {
      restorePath();
    }
  });

  it("does not cache unavailable detections (so a fix is picked up immediately)", async () => {
    const config = {
      id: "still-missing-cli",
      displayName: "Still missing",
      runtimeKind: "local" as const,
      command: "writer-still-missing-xyz",
      unavailableMessage: "Install it.",
      buildRunArgs: (prompt: string) => [prompt]
    };

    const first = await detectCliAdapter(config);
    const second = await detectCliAdapter(config);

    expect(first.adapter.available).toBe(false);
    expect(second.adapter.available).toBe(false);
    // Different object identity → no cache hit on failures.
    expect(second).not.toBe(first);
  });

  it("force: true bypasses the cache", async () => {
    const { restorePath } = await installFakeCli("writer-cli-force-", "force-cli", {
      bash: ["exit 0"],
      batch: ["exit /b 0"]
    });

    try {
      const config = {
        id: "force-cli",
        displayName: "Force",
        runtimeKind: "local" as const,
        command: "force-cli",
        unavailableMessage: "Install Force.",
        buildRunArgs: (prompt: string) => [prompt]
      };

      const cached = await detectCliAdapter(config);
      const forced = await detectCliAdapter(config, { force: true });

      expect(cached.adapter.available).toBe(true);
      expect(forced.adapter.available).toBe(true);
      expect(forced).not.toBe(cached);
    } finally {
      restorePath();
    }
  });
});
