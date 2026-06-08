import type { LocalModelManifest } from "@writer/contracts";

// Pinned artifact: ggml-org/gemma-4-E4B-it-GGUF, file gemma-4-E4B-it-Q8_0.gguf
// sha256 sourced from Git LFS pointer (oid sha256) on 2026-05-28.
// This repo is ungated — download requires no HF auth token.
// If the repo becomes gated, use WRITER_HF_TOKEN env var (WRI-157 secret storage).
export const GEMMA_4_E4B_MANIFEST: LocalModelManifest = {
  modelId: "gemma-4-e4b",
  displayName: "Gemma 4 E4B",
  sourceRepo: "ggml-org/gemma-4-E4B-it-GGUF",
  fileName: "gemma-4-E4B-it-Q8_0.gguf",
  downloadUrl:
    "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q8_0.gguf",
  expectedSha256: "fb8f0c032de00b18c710824af3c7e5777c71e5fb60b13f13575f0a9e92ddecd0",
  gated: false,
  modelMaxContext: 131072,
  defaultContext: 16384,
  fileSizeBytes: 8_600_000_000
};

// Pinned artifact: ggml-org/gemma-4-E4B-it-GGUF, file gemma-4-E4B-it-Q4_K_M.gguf
// sha256 and size sourced from Git LFS pointer on 2026-06-02.
// Fallback for GPUs with < 12 GB VRAM.
export const GEMMA_4_E4B_Q4KM_MANIFEST: LocalModelManifest = {
  modelId: "gemma-4-e4b",
  displayName: "Gemma 4 E4B",
  sourceRepo: "ggml-org/gemma-4-E4B-it-GGUF",
  fileName: "gemma-4-E4B-it-Q4_K_M.gguf",
  downloadUrl:
    "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf",
  expectedSha256: "90ce98129eb3e8cc57e62433d500c97c624b1e3af1fcc85dd3b55ad7e0313e9f",
  gated: false,
  modelMaxContext: 131072,
  defaultContext: 16384,
  fileSizeBytes: 5_335_289_824
};

// Pinned artifact: bartowski/gemma-4-12B-it-GGUF, file gemma-4-12B-it-Q4_K_M.gguf
// sha256 and size sourced from HuggingFace API on 2026-06-08.
// Primary model for GPUs with >= 12 GB VRAM (7.66 GB, fits with ~4 GB KV-cache headroom).
export const GEMMA_4_12B_Q4KM_MANIFEST: LocalModelManifest = {
  modelId: "gemma-4-12b",
  displayName: "Gemma 4 12B",
  sourceRepo: "bartowski/gemma-4-12B-it-GGUF",
  fileName: "gemma-4-12B-it-Q4_K_M.gguf",
  downloadUrl:
    "https://huggingface.co/bartowski/gemma-4-12B-it-GGUF/resolve/main/gemma-4-12B-it-Q4_K_M.gguf",
  expectedSha256: "d333b368be6cd655563fce18aede26027e208fdb13816d35eb06983ce054044b",
  gated: false,
  modelMaxContext: 262144,
  // 24K fits in 12 GB with ~2 GB headroom for the shared desktop GPU (measured
  // 2026-06-08: 32K leaves only ~1.2 GB, too tight under browser/Figma load).
  defaultContext: 24576,
  fileSizeBytes: 7_662_531_872
};

export const ALL_LOCAL_MODEL_MANIFESTS: LocalModelManifest[] = [
  GEMMA_4_E4B_MANIFEST,
  GEMMA_4_E4B_Q4KM_MANIFEST,
  GEMMA_4_12B_Q4KM_MANIFEST
];

export type ManifestResolution =
  | { manifest: LocalModelManifest }
  | { blocked: true; reason: string };

// Real 12 GB cards report slightly under 12288 MiB — use 12000 so they qualify for the 12B model.
export const VRAM_12B_MIN_MIB = 12000;

export function resolveLocalModelManifest(vram: number | null): ManifestResolution {
  if (vram === null) {
    return { blocked: true, reason: "No compatible NVIDIA GPU detected" };
  }
  return { manifest: vram >= VRAM_12B_MIN_MIB ? GEMMA_4_12B_Q4KM_MANIFEST : GEMMA_4_E4B_Q4KM_MANIFEST };
}
