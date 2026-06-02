/**
 * Download llama.cpp CUDA 12.4 build + CUDA runtime for GPU-only inference.
 * Outputs to apps/desktop/build/llama/ — all files copied to resources/llama/ in the installer.
 *
 * Requires two zips from llama.cpp releases:
 *   - llama-b9481-bin-win-cuda-12.4-x64.zip  → ggml-cuda.dll + all DLLs/EXEs
 *   - cudart-llama-bin-win-cuda-12.4-x64.zip  → CUDA runtime (cudart64_12.dll, cublas, etc.)
 *
 * Downloads are skipped if llama-cli.exe already exists and is > 1KB.
 * Run with: npm run build:llama
 */

import https from "node:https";
import { createWriteStream, mkdirSync, existsSync, statSync, rmSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../build/llama");
const outFile = path.join(outDir, "llama-cli.exe");

mkdirSync(outDir, { recursive: true });

if (existsSync(outFile) && statSync(outFile).size > 1000) {
  console.log("llama-cli.exe already present — skipping download.");
  console.log("Delete build/llama/ to re-download.");
  process.exit(0);
}

const RELEASE_TAG = "b9481";
const BASE = `https://github.com/ggml-org/llama.cpp/releases/download/${RELEASE_TAG}`;
const CUDA_ZIP = `llama-${RELEASE_TAG}-bin-win-cuda-12.4-x64.zip`;
const CUDART_ZIP = `cudart-llama-bin-win-cuda-12.4-x64.zip`;

const execAsync = promisify(exec);

// ── Step 1: CUDA llama build (ggml-cuda.dll + all EXEs/DLLs) ────────────────
const cudaZipPath = path.join(outDir, "cuda-llama.zip");
if (!existsSync(cudaZipPath)) {
  console.log(`\nDownloading CUDA llama build (~373MB)…`);
  await download(`${BASE}/${CUDA_ZIP}`, cudaZipPath);
}

console.log("Extracting CUDA llama build…");
await execAsync(
  `powershell -Command "Expand-Archive -Path '${cudaZipPath}' -DestinationPath '${outDir}' -Force"`,
  { timeout: 120000 }
);
rmSync(cudaZipPath, { force: true });
console.log("CUDA llama build extracted.");

// ── Step 2: CUDA runtime (cudart64_12.dll, cublas, etc.) ────────────────────
const cudartZipPath = path.join(outDir, "cudart.zip");
if (!existsSync(cudartZipPath)) {
  console.log(`\nDownloading CUDA runtime (~248MB)…`);
  await download(`${BASE}/${CUDART_ZIP}`, cudartZipPath);
}

console.log("Extracting CUDA runtime…");
await execAsync(
  `powershell -Command "Expand-Archive -Path '${cudartZipPath}' -DestinationPath '${outDir}' -Force"`,
  { timeout: 120000 }
);
rmSync(cudartZipPath, { force: true });
console.log("CUDA runtime extracted.");

console.log(`\nllama build ready → ${outDir}`);
console.log("Files:", (await execAsync(`powershell -Command "(Get-ChildItem '${outDir}').Count"`)).stdout.trim());

// ── helpers ──────────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    function get(url) {
      https.get(url, { headers: { "User-Agent": "writer-build/1.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let received = 0;
        res.on("data", (chunk) => {
          received += chunk.length;
          if (total) process.stdout.write(
            `\r  ${Math.round((received / total) * 100)}% (${Math.round(received / 1e6)}MB / ${Math.round(total / 1e6)}MB)`
          );
        });
        const out = createWriteStream(dest);
        pipeline(res, out).then(() => { process.stdout.write("\n"); resolve(); }).catch(reject);
      }).on("error", reject);
    }
    get(url);
  });
}
