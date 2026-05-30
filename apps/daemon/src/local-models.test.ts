import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";

import { PlatformStore } from "@writer/storage";

import { getLocalModelStatus, startModelDownload, resetModelDownload, initLocalModelState, installDraftModel, setSpeculativeDecodingEnabled, getDraftFilePath } from "./local-models";
import { GEMMA_4_E4B_MANIFEST } from "./local-model-manifest";
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

describe("installDraftModel", () => {
  let state: DaemonState;
  let dataDir: string;

  beforeEach(async () => {
    dataDir = join(tmpdir(), `writer-draft-test-${randomUUID()}`);
    await mkdir(dataDir, { recursive: true });
    state = makeDaemonState(dataDir);
    await state.store.load();
  });

  it("returns installed:false when the manifest has no draftModel", async () => {
    const manifest = { ...GEMMA_4_E4B_MANIFEST, draftModel: undefined };
    const result = await installDraftModel(state, manifest);
    expect(result.installed).toBe(false);
    if (!result.installed) {
      expect(result.reason).toMatch(/no draft model/i);
    }
  });

  it("rejects with SHA mismatch and cleans up partial file", async () => {
    const draftContent = "fake draft model content";
    const wrongSha = "a".repeat(64); // deliberately wrong
    const manifest = {
      ...GEMMA_4_E4B_MANIFEST,
      draftModel: {
        url: "https://example.com/draft.gguf",
        sha256: wrongSha,
        sizeBytes: draftContent.length,
        fileName: "draft.gguf"
      }
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(draftContent));
          controller.close();
        }
      }),
      headers: new Headers({ "content-length": String(draftContent.length) })
    }));

    await expect(installDraftModel(state, manifest)).rejects.toThrow(/sha/i);

    // Partial file must be cleaned up
    const partialPath = join(dataDir, "models", "draft.gguf.partial");
    await expect(stat(partialPath)).rejects.toThrow();

    vi.unstubAllGlobals();
  });

  it("is idempotent when target file exists with correct SHA", async () => {
    const draftContent = "fake draft model content";
    const correctSha = createHash("sha256").update(draftContent).digest("hex");
    const manifest = {
      ...GEMMA_4_E4B_MANIFEST,
      draftModel: {
        url: "https://example.com/draft.gguf",
        sha256: correctSha,
        sizeBytes: draftContent.length,
        fileName: "draft.gguf"
      }
    };

    // Pre-place the file with the correct content
    const modelsDir = join(dataDir, "models");
    await mkdir(modelsDir, { recursive: true });
    await writeFile(join(modelsDir, "draft.gguf"), draftContent, "utf8");

    // Should NOT fetch — idempotent check
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await installDraftModel(state, manifest);
    expect(result.installed).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

describe("setSpeculativeDecodingEnabled", () => {
  let state: DaemonState;

  beforeEach(async () => {
    const dataDir = join(tmpdir(), `writer-draft-test-${randomUUID()}`);
    await mkdir(dataDir, { recursive: true });
    state = makeDaemonState(dataDir);
    await state.store.load();
  });

  it("persists enabled=true", async () => {
    await setSpeculativeDecodingEnabled(state, true);
    expect(state.store.getSpeculativeDecoding().enabled).toBe(true);
  });

  it("persists enabled=false and clears lastError", async () => {
    state.store.setSpeculativeDecoding({ enabled: true, lastError: "old error" });
    await setSpeculativeDecodingEnabled(state, false);
    const dec = state.store.getSpeculativeDecoding();
    expect(dec.enabled).toBe(false);
    expect(dec.lastError).toBeUndefined();
  });
});
