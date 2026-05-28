import { describe, it, expect } from "vitest";
import {
  localModelManifestSchema,
  localModelStateSchema,
  localModelStatusResponseSchema,
  parseLocalModelStatusResponse
} from "./local-model";

const VALID_MANIFEST = {
  modelId: "gemma-4-e4b",
  displayName: "Gemma 4 E4B",
  sourceRepo: "ggml-org/gemma-4-E4B-it-GGUF",
  fileName: "gemma-4-E4B-it-Q8_0.gguf",
  downloadUrl: "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q8_0.gguf",
  expectedSha256: "fb8f0c032de00b18c710824af3c7e5777c71e5fb60b13f13575f0a9e92ddecd0",
  gated: false,
  modelMaxContext: 131072,
  defaultContext: 8192,
  fileSizeBytes: 8_600_000_000
};

describe("localModelManifestSchema", () => {
  it("parses a valid manifest", () => {
    const result = localModelManifestSchema.safeParse(VALID_MANIFEST);
    expect(result.success).toBe(true);
  });

  it("rejects manifest with wrong sha256 length", () => {
    const result = localModelManifestSchema.safeParse({ ...VALID_MANIFEST, expectedSha256: "tooshort" });
    expect(result.success).toBe(false);
  });

  it("rejects manifest with invalid url", () => {
    const result = localModelManifestSchema.safeParse({ ...VALID_MANIFEST, downloadUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });
});

describe("localModelStateSchema", () => {
  it("parses not_installed state", () => {
    const state = localModelStateSchema.parse({
      status: "not_installed",
      modelPath: null,
      downloadedBytes: 0,
      totalBytes: 0,
      errorMessage: null,
      installedAt: null
    });
    expect(state.status).toBe("not_installed");
  });

  it("parses downloading state with progress", () => {
    const state = localModelStateSchema.parse({
      status: "downloading",
      modelPath: null,
      downloadedBytes: 500_000_000,
      totalBytes: 8_600_000_000,
      errorMessage: null,
      installedAt: null
    });
    expect(state.downloadedBytes).toBe(500_000_000);
  });

  it("parses failed state with error message", () => {
    const state = localModelStateSchema.parse({
      status: "failed",
      modelPath: null,
      downloadedBytes: 0,
      totalBytes: 0,
      errorMessage: "Checksum mismatch",
      installedAt: null
    });
    expect(state.errorMessage).toBe("Checksum mismatch");
    expect(state.modelPath).toBeNull();
  });

  it("parses installed state with path and timestamp", () => {
    const now = new Date().toISOString();
    const state = localModelStateSchema.parse({
      status: "installed",
      modelPath: "/home/user/.writer/models/gemma-4-E4B-it-Q8_0.gguf",
      downloadedBytes: 8_600_000_000,
      totalBytes: 8_600_000_000,
      errorMessage: null,
      installedAt: now
    });
    expect(state.status).toBe("installed");
    expect(state.modelPath).toBeTruthy();
    expect(state.installedAt).toBe(now);
  });

  it("rejects negative downloadedBytes", () => {
    const result = localModelStateSchema.safeParse({
      status: "downloading",
      modelPath: null,
      downloadedBytes: -1,
      totalBytes: 100,
      errorMessage: null,
      installedAt: null
    });
    expect(result.success).toBe(false);
  });
});

describe("parseLocalModelStatusResponse", () => {
  it("parses a full status response", () => {
    const response = parseLocalModelStatusResponse({
      manifest: VALID_MANIFEST,
      state: {
        status: "not_installed",
        modelPath: null,
        downloadedBytes: 0,
        totalBytes: 0,
        errorMessage: null,
        installedAt: null
      }
    });
    expect(response.manifest.modelId).toBe("gemma-4-e4b");
    expect(response.state.status).toBe("not_installed");
  });

  it("throws on invalid payload", () => {
    expect(() => parseLocalModelStatusResponse({ invalid: true })).toThrow();
  });
});
