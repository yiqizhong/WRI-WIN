import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";

import { PlatformStore } from "@writer/storage";
import * as agentAdapters from "@writer/agent-adapters";

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
    vi.spyOn(agentAdapters, "detectNvidiaVram").mockResolvedValue(12288);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns not_installed status when no model state exists", async () => {
    const status = await getLocalModelStatus(state);
    expect(status.state.status).toBe("not_installed");
    expect(status.state.modelPath).toBeNull();
    expect(status.manifest.modelId).toBe("gemma-4-12b");
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

    const status = await getLocalModelStatus(state);
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

    const status = await getLocalModelStatus(state);
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

  it("startModelDownload throws when GPU is blocked", async () => {
    vi.spyOn(agentAdapters, "detectNvidiaVram").mockResolvedValue(null);
    await expect(startModelDownload(state)).rejects.toThrow(/No compatible NVIDIA GPU/i);
  });

  it("startModelDownload initializes download with Q4_K_M size for 8 GB GPU", async () => {
    vi.spyOn(agentAdapters, "detectNvidiaVram").mockResolvedValue(8192);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, body: null, headers: new Headers() }));

    const result = await startModelDownload(state);
    expect(result.started).toBe(true);

    const stored = state.store.getLocalModel();
    expect(stored?.totalBytes).toBe(5_335_289_824);

    vi.unstubAllGlobals();
  });

  it("restarts (does not append) when a resume gets HTTP 200 with Range ignored", async () => {
    // 8 GB GPU → Q4_K_M manifest, fileName gemma-4-E4B-it-Q4_K_M.gguf
    vi.spyOn(agentAdapters, "detectNvidiaVram").mockResolvedValue(8192);

    const modelsDir = join(dataDir, "models");
    await mkdir(modelsDir, { recursive: true });
    const tempPath = join(modelsDir, "gemma-4-E4B-it-Q4_K_M.gguf.tmp");

    // Simulate an interrupted download: a partial .tmp already on disk, and the
    // store carrying a (possibly under-counted) downloadedBytes from a crash.
    const partialBytes = 5000;
    await writeFile(tempPath, Buffer.alloc(partialBytes, 1));
    state.store.setLocalModel({
      status: "failed",
      modelPath: null,
      downloadedBytes: 3000, // under-counts the real 5000-byte .tmp
      totalBytes: 5_335_289_824,
      errorMessage: "Download interrupted",
      installedAt: null
    });
    await state.store.save();

    // Server IGNORES the Range header and returns the FULL body with HTTP 200.
    const fullBody = Buffer.alloc(20000, 2);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(fullBody));
          controller.close();
        }
      }),
      headers: new Headers({ "content-length": String(fullBody.length) })
    }));

    const result = await startModelDownload(state);
    expect(result.started).toBe(true);

    // runDownload is fire-and-forget; wait for it to settle (SHA mismatch on the
    // mocked body → status leaves "downloading"/"verifying").
    for (let i = 0; i < 200; i++) {
      const s = state.store.getLocalModel();
      if (s && s.status !== "downloading" && s.status !== "verifying") break;
      await new Promise((r) => setTimeout(r, 10));
    }

    const stored = state.store.getLocalModel();
    // Restart (truncate) — bytes written equal the full body, NOT partial + full.
    expect(stored?.downloadedBytes).toBe(fullBody.length);
    expect(stored?.downloadedBytes).not.toBe(partialBytes + fullBody.length);

    // The .tmp must not have grown to partial+full (no corruption-by-append).
    let tmpStillThere = true;
    let tmpSize = 0;
    try {
      tmpSize = (await stat(tempPath)).size;
    } catch {
      tmpStillThere = false;
    }
    if (tmpStillThere) {
      expect(tmpSize).toBeLessThanOrEqual(fullBody.length);
    }

    vi.unstubAllGlobals();
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

    const status = await getLocalModelStatus(state);
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

    const status = await getLocalModelStatus(state);
    expect(status.state.status).toBe("installed");
    expect(status.state.modelPath).toBe("/some/path/model.gguf");
    expect(status.state.installedAt).toBe(installedAt);
  });

  it("getLocalModelStatus returns blockedReason when no NVIDIA GPU detected", async () => {
    vi.spyOn(agentAdapters, "detectNvidiaVram").mockResolvedValue(null);
    const status = await getLocalModelStatus(state);
    expect(status.blockedReason).toMatch(/No compatible NVIDIA GPU/i);
  });

  it("getLocalModelStatus returns Q4_K_M manifest for 8 GB GPU", async () => {
    vi.spyOn(agentAdapters, "detectNvidiaVram").mockResolvedValue(8192);
    const status = await getLocalModelStatus(state);
    expect(status.manifest.fileName).toBe("gemma-4-E4B-it-Q4_K_M.gguf");
    expect(status.blockedReason).toBeNull();
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

  it("downloads, verifies SHA, and installs successfully on fresh download", async () => {
    const draftContent = "fake draft model content for happy path";
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

    const result = await installDraftModel(state, manifest);
    expect(result.installed).toBe(true);
    if (result.installed) {
      expect(result.path).toContain("draft.gguf");
      // Verify the file actually exists on disk
      await expect(stat(result.path)).resolves.toBeDefined();
    }

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
