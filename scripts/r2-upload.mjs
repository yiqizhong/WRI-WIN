import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createReadStream, statSync, readFileSync, writeFileSync } from "node:fs";

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
const VERSION = "0.6.0"; // <-- bump this before each release

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
    console.warn(`  [warn] Could not read ${mdPath} — skipping release notes`);
    return undefined;
  }
  const start = text.indexOf(`## [${version}]`);
  if (start === -1) {
    console.warn(`  [warn] No entry for v${version} in CHANGELOG.md — skipping release notes`);
    return undefined;
  }
  const afterHeader = text.indexOf("\n", start) + 1;
  const nextSection = text.indexOf("\n## [", afterHeader);
  const block = text.slice(afterHeader, nextSection === -1 ? undefined : nextSection).trim();
  return block || undefined;
}

/**
 * Patches latest.yml by inserting releaseNotes after the version line.
 * electron-updater reads this field and exposes it as UpdateInfo.releaseNotes.
 */
function patchLatestYml(ymlPath, notes) {
  let yml = readFileSync(ymlPath, "utf8");
  const notesLine = `releaseNotes: ${JSON.stringify(notes)}\n`;
  if (/^releaseNotes:/m.test(yml)) {
    // Replace the existing field — don't insert a duplicate
    yml = yml.replace(/^releaseNotes:.+\n/m, notesLine);
  } else {
    yml = yml.replace(/^(version:.+\n)/, `$1${notesLine}`);
  }
  writeFileSync(ymlPath, yml);
  console.log(`  Patched latest.yml with release notes for v${VERSION}`);
}

// Inject release notes into latest.yml before uploading it
const notes = parseChangelog("CHANGELOG.md", VERSION);
if (notes) {
  patchLatestYml(`${DIST}\\latest.yml`, notes);
}

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
