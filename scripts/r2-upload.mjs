import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, statSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import yaml from "js-yaml";

const client = new S3Client({
  region: "auto",
  endpoint: "https://3731cbcdfcd95517351b81a675ee49f2.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_KEY_ID,
    secretAccessKey: process.env.R2_SECRET,
  },
});

const BUCKET = "writerapp-updates";
const DIST = "C:\\WRI\\Writer\\apps\\desktop\\dist-electron";
const VERSION = "0.6.4"; // <-- bump this before each release

const FILES = [
  { local: `${DIST}\\Writer Setup ${VERSION}.exe`,          key: `Writer Setup ${VERSION}.exe` },
  { local: `${DIST}\\Writer Setup ${VERSION}.exe.blockmap`, key: `Writer Setup ${VERSION}.exe.blockmap` },
  { local: `${DIST}\\latest.yml`,                           key: "latest.yml" },
];

/**
 * Reads CHANGELOG.md and extracts the release notes block for the given version.
 * Returns the trimmed block string, or undefined if not found.
 */
function parseChangelog(mdPath, version) {
  let text;
  try {
    text = readFileSync(mdPath, "utf8");
  } catch {
    return undefined;
  }
  const start = text.indexOf(`## [${version}]`);
  if (start === -1) return undefined;
  const afterHeader = text.indexOf("\n", start) + 1;
  const nextSection = text.indexOf("\n## [", afterHeader);
  const block = text.slice(afterHeader, nextSection === -1 ? undefined : nextSection).trim();
  return block || undefined;
}

/**
 * Patches latest.yml by setting releaseNotes via proper YAML parse/dump.
 * electron-updater reads this field and exposes it as UpdateInfo.releaseNotes.
 * Using js-yaml avoids regex fragility — works regardless of what
 * electron-builder generates around the field.
 */
function patchLatestYml(ymlPath, notes) {
  const raw = readFileSync(ymlPath, "utf8");
  const doc = yaml.load(raw);
  doc.releaseNotes = notes;

  // Inject blockMapSize into each file entry so electron-updater activates
  // differential downloads. Without this field it falls back to a full download,
  // re-downloading llama/CUDA binaries even when they haven't changed.
  const distDir = dirname(ymlPath);
  for (const file of doc.files ?? []) {
    if (!file.blockMapSize) {
      try {
        file.blockMapSize = statSync(join(distDir, file.url + ".blockmap")).size;
      } catch {
        console.warn(`  [warn] No blockmap found for ${file.url} — differential updates disabled for this file`);
      }
    }
  }

  writeFileSync(ymlPath, yaml.dump(doc, { lineWidth: -1 }));
  console.log(`  Patched latest.yml with release notes and blockMapSize for v${VERSION}`);
}

// Release notes are required — abort if the changelog entry is missing.
const notes = parseChangelog("CHANGELOG.md", VERSION);
if (!notes) {
  console.error(`\n  [error] No changelog entry found for v${VERSION} in CHANGELOG.md.`);
  console.error(`  Add a "## [${VERSION}]" section before running the upload.\n`);
  process.exit(1);
}
patchLatestYml(`${DIST}\\latest.yml`, notes);

for (const { local, key } of FILES) {
  const size = statSync(local).size;
  console.log(`\nUploading: ${key} (${(size / 1_048_576).toFixed(1)} MB)`);

  const upload = new Upload({
    client,
    params: { Bucket: BUCKET, Key: key, Body: createReadStream(local) },
    partSize: 64 * 1024 * 1024,
    queueSize: 4,
  });

  upload.on("httpUploadProgress", ({ loaded, total }) => {
    const pct = total ? Math.round((loaded / total) * 100) : "?";
    process.stdout.write(`\r  ${pct}% (${(loaded / 1_048_576).toFixed(0)} / ${(total / 1_048_576).toFixed(0)} MB)`);
  });

  await upload.done();
  console.log(`\r  Done: ${key}                    `);
}

console.log(`\nAll files uploaded. latest.yml is live — v${VERSION} is published.`);
