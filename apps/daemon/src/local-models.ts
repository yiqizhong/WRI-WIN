import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import type { LocalModelState, LocalModelStatusResponse } from "@writer/contracts";

import type { DaemonState } from "./state";
import { GEMMA_4_E4B_MANIFEST } from "./local-model-manifest";

let activeDownload: AbortController | null = null;

export function getModelsDir(state: DaemonState): string {
  return join(state.store.dataDir, "models");
}

export function getModelFilePath(state: DaemonState): string {
  return join(getModelsDir(state), GEMMA_4_E4B_MANIFEST.fileName);
}

function buildState(override: Partial<LocalModelState> = {}): LocalModelState {
  return {
    status: "not_installed",
    modelPath: null,
    downloadedBytes: 0,
    totalBytes: 0,
    errorMessage: null,
    installedAt: null,
    ...override
  };
}

/** Called on daemon startup to recover from interrupted downloads. */
export async function initLocalModelState(state: DaemonState): Promise<void> {
  const current = state.store.getLocalModel();
  if (!current) {
    return;
  }

  // An in-progress download did not survive the restart — mark failed so the
  // user can retry. Preserve downloaded bytes for the progress display.
  if (current.status === "downloading" || current.status === "verifying") {
    state.store.setLocalModel(
      buildState({ status: "failed", downloadedBytes: current.downloadedBytes, totalBytes: current.totalBytes, errorMessage: "Download interrupted by daemon restart." })
    );
    await state.store.save();
    return;
  }

  // Verify that the installed file still exists.
  if (current.status === "installed" || current.status === "ready") {
    if (!current.modelPath) {
      state.store.setLocalModel(buildState());
      await state.store.save();
      return;
    }

    try {
      await stat(current.modelPath);
    } catch {
      state.store.setLocalModel(buildState());
      await state.store.save();
    }
  }
}

export function getLocalModelStatus(state: DaemonState): LocalModelStatusResponse {
  const stored = state.store.getLocalModel();
  return {
    manifest: GEMMA_4_E4B_MANIFEST,
    state: stored ?? buildState()
  };
}

export async function startModelDownload(state: DaemonState): Promise<{ started: boolean }> {
  const current = state.store.getLocalModel();

  if (current?.status === "downloading" || current?.status === "verifying") {
    return { started: false };
  }

  if (current?.status === "installed" || current?.status === "ready") {
    return { started: false };
  }

  const resumeFrom = current?.downloadedBytes ?? 0;
  state.store.setLocalModel(
    buildState({
      status: "downloading",
      downloadedBytes: resumeFrom,
      totalBytes: current?.totalBytes || GEMMA_4_E4B_MANIFEST.fileSizeBytes
    })
  );
  await state.store.save();

  // Fire-and-forget; errors are written back to the store.
  void runDownload(state, resumeFrom).catch(async (error) => {
    const message = error instanceof Error ? error.message : "Download failed";
    const partial = state.store.getLocalModel();
    state.store.setLocalModel(
      buildState({ status: "failed", downloadedBytes: partial?.downloadedBytes ?? 0, totalBytes: partial?.totalBytes ?? 0, errorMessage: message })
    );
    await state.store.save();
  });

  return { started: true };
}

async function runDownload(state: DaemonState, resumeFrom: number): Promise<void> {
  const modelsDir = getModelsDir(state);
  const finalPath = getModelFilePath(state);
  const tempPath = `${finalPath}.tmp`;

  await mkdir(modelsDir, { recursive: true });

  activeDownload = new AbortController();
  const { signal } = activeDownload;

  const headers: Record<string, string> = {};
  if (resumeFrom > 0) {
    headers["Range"] = `bytes=${resumeFrom}-`;
  }

  // Optional HF auth token for if the repo ever becomes gated.
  const hfToken = process.env["WRITER_HF_TOKEN"];
  if (hfToken) {
    headers["Authorization"] = `Bearer ${hfToken}`;
  }

  const response = await fetch(GEMMA_4_E4B_MANIFEST.downloadUrl, {
    headers,
    signal,
    redirect: "follow"
  });

  if (response.status !== 200 && response.status !== 206) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  const totalBytes = resumeFrom + contentLength || GEMMA_4_E4B_MANIFEST.fileSizeBytes;

  const fileStream = createWriteStream(tempPath, { flags: resumeFrom > 0 ? "a" : "w" });
  let downloadedBytes = resumeFrom;
  let lastSave = Date.now();

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is empty");
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      await new Promise<void>((resolve, reject) => {
        fileStream.write(value, (err) => (err ? reject(err) : resolve()));
      });

      downloadedBytes += value.length;

      const now = Date.now();
      if (now - lastSave > 2000) {
        state.store.setLocalModel(
          buildState({ status: "downloading", downloadedBytes, totalBytes })
        );
        await state.store.save();
        lastSave = now;
      }
    }
  } finally {
    reader.releaseLock();
    await new Promise<void>((resolve) => fileStream.end(resolve));
  }

  activeDownload = null;

  state.store.setLocalModel(buildState({ status: "verifying", downloadedBytes, totalBytes }));
  await state.store.save();

  const actualSha256 = await computeSha256(tempPath);

  if (actualSha256 !== GEMMA_4_E4B_MANIFEST.expectedSha256) {
    await rm(tempPath, { force: true });
    throw new Error(
      `Checksum mismatch: expected ${GEMMA_4_E4B_MANIFEST.expectedSha256}, got ${actualSha256}`
    );
  }

  await rename(tempPath, finalPath);

  state.store.setLocalModel(
    buildState({
      status: "installed",
      modelPath: finalPath,
      downloadedBytes,
      totalBytes,
      installedAt: new Date().toISOString()
    })
  );
  await state.store.save();
}

async function computeSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk as Buffer));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

export async function resetModelDownload(state: DaemonState): Promise<void> {
  activeDownload?.abort();
  activeDownload = null;

  const modelsDir = getModelsDir(state);
  const finalPath = getModelFilePath(state);
  const tempPath = `${finalPath}.tmp`;

  // Defensive: recreate dir before removal attempts
  await mkdir(modelsDir, { recursive: true });
  await Promise.all([rm(finalPath, { force: true }), rm(tempPath, { force: true })]);

  state.store.setLocalModel(buildState());
  await state.store.save();
}
