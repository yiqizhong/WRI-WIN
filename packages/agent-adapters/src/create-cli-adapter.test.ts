import { afterEach, describe, expect, it } from "vitest";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { clearAdapterDetectionCache, detectCliAdapter } from "./create-cli-adapter";

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

  it("caches successful detections so a second call within TTL returns the same object", async () => {
    // A trivial available "CLI" that just exits 0 on --version.
    const binDir = await mkdtemp(join(tmpdir(), "writer-cli-cache-"));
    const commandPath = join(binDir, "fake-cli");
    await writeFile(commandPath, ["#!/usr/bin/env bash", "echo v1", "exit 0"].join("\n"));
    await chmod(commandPath, 0o755);

    const previousPath = process.env.PATH;
    process.env.PATH = `${binDir}:${previousPath ?? ""}`;
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
      process.env.PATH = previousPath;
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
    const binDir = await mkdtemp(join(tmpdir(), "writer-cli-force-"));
    const commandPath = join(binDir, "force-cli");
    await writeFile(commandPath, ["#!/usr/bin/env bash", "exit 0"].join("\n"));
    await chmod(commandPath, 0o755);

    const previousPath = process.env.PATH;
    process.env.PATH = `${binDir}:${previousPath ?? ""}`;
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
      process.env.PATH = previousPath;
    }
  });
});
