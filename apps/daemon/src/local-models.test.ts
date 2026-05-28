import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { PlatformStore } from "@writer/storage";

import { getLocalModelStatus, startModelDownload, resetModelDownload, initLocalModelState } from "./local-models";
import type { DaemonState } from "./state";
import type { AgentRunHandle } from "@writer/agent-adapters";

function makeDaemonState(dataDir: string): DaemonState {
  const store = new PlatformStore({ dataDir });
  return {
    store,
    permissionRequests: [],
    activeRuns: new Map<string, { handle: AgentRunHandle }>(),
    mcp: {
      figma: {
        client: null,
        tokens: null,
        status: "disconnected",
        capabilities: []
      }
    } as unknown as DaemonState["mcp"]
  };
}

describe("local model lifecycle", () => {
  let state: DaemonState;
  let dataDir: string;

  beforeEach(async () => {
    dataDir = join(tmpdir(), `writer-test-${randomUUID()}`);
    await mkdir(dataDir, { recursive: true });
    state = makeDaemonState(dataDir);
    await state.store.load();
  });

  it("returns not_installed status when no model state exists", () => {
    const status = getLocalModelStatus(state);
    expect(status.state.status).toBe("not_installed");
    expect(status.state.modelPath).toBeNull();
    expect(status.manifest.modelId).toBe("gemma-4-e4b");
  });

  it("resets interrupted download to not_installed on init", async () => {
    state.store.setLocalModel({
      status: "downloading",
      modelPath: null,
      downloadedBytes: 500_000_000,
      totalBytes: 8_600_000_000,
      errorMessage: null,
      installedAt: null
    });
    await state.store.save();

    await initLocalModelState(state);

    const status = getLocalModelStatus(state);
    expect(status.state.status).toBe("failed");
    expect(status.state.errorMessage).toMatch(/restart/i);
  });

  it("resets interrupted verify to failed on init", async () => {
    state.store.setLocalModel({
      status: "verifying",
      modelPath: null,
      downloadedBytes: 8_600_000_000,
      totalBytes: 8_600_000_000,
      errorMessage: null,
      installedAt: null
    });
    await state.store.save();

    await initLocalModelState(state);

    const status = getLocalModelStatus(state);
    expect(status.state.status).toBe("failed");
  });

  it("startModelDownload returns started:false when already downloading", async () => {
    state.store.setLocalModel({
      status: "downloading",
      modelPath: null,
      downloadedBytes: 100,
      totalBytes: 8_600_000_000,
      errorMessage: null,
      installedAt: null
    });
    await state.store.save();

    // Mock fetch to avoid real network call
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, body: null, headers: new Headers() }));

    const result = await startModelDownload(state);
    expect(result.started).toBe(false);

    vi.unstubAllGlobals();
  });

  it("startModelDownload returns started:false when already installed", async () => {
    state.store.setLocalModel({
      status: "installed",
      modelPath: join(dataDir, "models", "gemma-4-E4B-it-Q8_0.gguf"),
      downloadedBytes: 8_600_000_000,
      totalBytes: 8_600_000_000,
      errorMessage: null,
      installedAt: new Date().toISOString()
    });
    await state.store.save();

    const result = await startModelDownload(state);
    expect(result.started).toBe(false);
  });

  it("resetModelDownload clears state to not_installed", async () => {
    state.store.setLocalModel({
      status: "failed",
      modelPath: null,
      downloadedBytes: 0,
      totalBytes: 0,
      errorMessage: "Something went wrong",
      installedAt: null
    });
    await state.store.save();

    await resetModelDownload(state);

    const status = getLocalModelStatus(state);
    expect(status.state.status).toBe("not_installed");
    expect(status.state.errorMessage).toBeNull();
    expect(status.state.downloadedBytes).toBe(0);
  });

  it("getLocalModelStatus reflects persisted state", async () => {
    const installedAt = new Date().toISOString();
    state.store.setLocalModel({
      status: "installed",
      modelPath: "/some/path/model.gguf",
      downloadedBytes: 8_600_000_000,
      totalBytes: 8_600_000_000,
      errorMessage: null,
      installedAt
    });
    await state.store.save();

    const status = getLocalModelStatus(state);
    expect(status.state.status).toBe("installed");
    expect(status.state.modelPath).toBe("/some/path/model.gguf");
    expect(status.state.installedAt).toBe(installedAt);
  });
});
