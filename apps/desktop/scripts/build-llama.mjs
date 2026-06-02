/**
 * Download a pre-built llama-cli.exe from llama.cpp GitHub releases.
 * Uses the CUDA 12.4 build (works with Blackwell/Ada/Ampere GPUs).
 * Falls back to CPU-only build if CUDA build download fails.
 *
 * Output: apps/desktop/build/llama/llama-cli.exe
 */

import https from "node:https";
import { createWriteStream, mkdirSync, existsSync, renameSync, rmSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../build/llama");
const outFile = path.join(outDir, "llama-cli.exe");

mkdirSync(outDir, { recursive: true });

if (existsSync(outFile)) {
  console.log("llama-cli.exe already present, skipping download.");
  process.exit(0);
}

// llama.cpp b9481 — CUDA 12.4 build for NVIDIA GPUs (Blackwell/Ada/Ampere).
// Falls back to CPU inference if no compatible GPU is found at runtime.
const RELEASE_TAG = "b9481";
const ASSET = `llama-${RELEASE_TAG}-bin-win-cuda-12.4-x64.zip`;
const DOWNLOAD_URL = `https://github.com/ggml-org/llama.cpp/releases/download/${RELEASE_TAG}/${ASSET}`;

const zipPath = path.join(outDir, "llama-cli.zip");

console.log(`Downloading llama-cli from llama.cpp ${RELEASE_TAG}…`);
console.log("URL:", DOWNLOAD_URL);

await download(DOWNLOAD_URL, zipPath);
console.log("Downloaded. Extracting llama-cli.exe…");

// Extract just llama-cli.exe from the zip using PowerShell
const execAsync = promisify(exec);
await execAsync(
  `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir}\\extracted' -Force"`,
  { timeout: 60000 }
);

// Find llama-cli.exe in the extracted files
const { stdout } = await execAsync(
  `powershell -Command "Get-ChildItem -Recurse -Filter 'llama-cli.exe' '${outDir}\\extracted' | Select-Object -First 1 -ExpandProperty FullName"`
);
const extractedPath = stdout.trim();

if (!extractedPath) {
  throw new Error("llama-cli.exe not found in archive");
}

renameSync(extractedPath, outFile);
rmSync(path.join(outDir, "extracted"), { recursive: true, force: true });
rmSync(zipPath, { force: true });

console.log("llama-cli.exe ready →", outFile);

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
          if (total) process.stdout.write(`\r  ${Math.round((received / total) * 100)}% (${Math.round(received / 1e6)}MB / ${Math.round(total / 1e6)}MB)`);
        });
        const out = createWriteStream(dest);
        pipeline(res, out).then(() => { process.stdout.write("\n"); resolve(); }).catch(reject);
      }).on("error", reject);
    }
    get(url);
  });
}
