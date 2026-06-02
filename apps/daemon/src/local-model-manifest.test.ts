import { describe, expect, it } from "vitest";

import {
  GEMMA_4_E4B_MANIFEST,
  GEMMA_4_E4B_Q4KM_MANIFEST,
  resolveLocalModelManifest
} from "./local-model-manifest";

describe("GEMMA_4_E4B_MANIFEST", () => {
  it("declares a 16K default context window", () => {
    expect(GEMMA_4_E4B_MANIFEST.defaultContext).toBe(16384);
  });

  it("keeps the default within the model's max context", () => {
    expect(GEMMA_4_E4B_MANIFEST.defaultContext).toBeLessThanOrEqual(
      GEMMA_4_E4B_MANIFEST.modelMaxContext
    );
  });
});

describe("GEMMA_4_E4B_Q4KM_MANIFEST", () => {
  it("has confirmed fileName", () => {
    expect(GEMMA_4_E4B_Q4KM_MANIFEST.fileName).toBe("gemma-4-E4B-it-Q4_K_M.gguf");
  });

  it("has confirmed fileSizeBytes", () => {
    expect(GEMMA_4_E4B_Q4KM_MANIFEST.fileSizeBytes).toBe(5335289824);
  });

  it("has confirmed expectedSha256", () => {
    expect(GEMMA_4_E4B_Q4KM_MANIFEST.expectedSha256).toBe(
      "90ce98129eb3e8cc57e62433d500c97c624b1e3af1fcc85dd3b55ad7e0313e9f"
    );
  });

  it("shares modelId and displayName with Q8_0", () => {
    expect(GEMMA_4_E4B_Q4KM_MANIFEST.modelId).toBe(GEMMA_4_E4B_MANIFEST.modelId);
    expect(GEMMA_4_E4B_Q4KM_MANIFEST.displayName).toBe(GEMMA_4_E4B_MANIFEST.displayName);
  });
});

describe("resolveLocalModelManifest", () => {
  it("returns Q8_0 for VRAM >= 12000 (exact boundary)", () => {
    const result = resolveLocalModelManifest(12000);
    expect("manifest" in result && result.manifest).toBe(GEMMA_4_E4B_MANIFEST);
  });

  it("returns Q8_0 for VRAM = 12288 (real 12 GB card)", () => {
    const result = resolveLocalModelManifest(12288);
    expect("manifest" in result && result.manifest).toBe(GEMMA_4_E4B_MANIFEST);
  });

  it("returns Q4_K_M for VRAM = 11999 (just below threshold)", () => {
    const result = resolveLocalModelManifest(11999);
    expect("manifest" in result && result.manifest).toBe(GEMMA_4_E4B_Q4KM_MANIFEST);
  });

  it("returns Q4_K_M for VRAM = 8192 (8 GB GPU)", () => {
    const result = resolveLocalModelManifest(8192);
    expect("manifest" in result && result.manifest).toBe(GEMMA_4_E4B_Q4KM_MANIFEST);
  });

  it("returns blocked for null VRAM", () => {
    const result = resolveLocalModelManifest(null);
    expect("blocked" in result && result.blocked).toBe(true);
    expect("reason" in result && result.reason).toMatch(/No compatible NVIDIA GPU/i);
  });
});
