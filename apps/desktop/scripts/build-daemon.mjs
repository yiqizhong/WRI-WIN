/**
 * Bundle the daemon to a single CJS file using esbuild,
 * then download a standalone node.exe to run it.
 *
 * Output: apps/desktop/build/daemon/
 *   daemon.cjs   — bundled daemon
 *   node.exe     — Node.js 22 LTS standalone binary (Windows x64)
 */

import { build } from "esbuild";
import { createWriteStream, mkdirSync, existsSync, chmodSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const daemonSrc = path.join(repoRoot, "apps/daemon/src/index.ts");
const outDir = path.join(__dirname, "../build/daemon");
const outFile = path.join(outDir, "daemon.mjs");

// Node.js 22 LTS standalone binary for Windows x64
const NODE_VERSION = "22.16.0";
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/win-x64/node.exe`;
const nodeOut = path.join(outDir, "node.exe");

mkdirSync(outDir, { recursive: true });

// ── Step 1: bundle daemon ────────────────────────────────────────────────────
console.log("Bundling daemon…");

await build({
  entryPoints: [daemonSrc],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: outFile,
  packages: "bundle",
  // Inject CJS require() compatibility so legacy CJS packages (e.g. gray-matter)
  // that call require('fs') / require('path') work inside the ESM bundle.
  banner: {
    js: `import { createRequire as __createRequire__ } from 'module'; const require = __createRequire__(import.meta.url);`
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  logLevel: "info"
});

console.log("Daemon bundled →", outFile);

// ── Step 2: download node.exe ────────────────────────────────────────────────
if (existsSync(nodeOut)) {
  console.log("node.exe already present, skipping download.");
} else {
  console.log(`Downloading Node.js ${NODE_VERSION} for Windows x64…`);
  await download(NODE_URL, nodeOut);
  console.log("node.exe downloaded →", nodeOut);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function download(url, dest) {
  return new Promise((resolve, reject) => {
    function get(url) {
      https.get(url, (res) => {
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
          if (total) {
            process.stdout.write(`\r  ${Math.round((received / total) * 100)}%`);
          }
        });
        const out = createWriteStream(dest);
        pipeline(res, out).then(() => { process.stdout.write("\n"); resolve(); }).catch(reject);
      }).on("error", reject);
    }
    get(url);
  });
}
