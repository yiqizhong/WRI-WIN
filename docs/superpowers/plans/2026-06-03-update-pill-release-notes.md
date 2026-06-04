# Update Pill Click-Through + Release Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "Downloading…" pill always clickable so users can re-open the progress modal, and display release notes from CHANGELOG.md in the upgrade modal.

**Architecture:** `releaseNotes` is threaded as an optional field on the `available` AppUpdateState discriminant — from the Zod contract through the electron-updater event mapper to the modal body. The upload script reads CHANGELOG.md at upload time and patches `latest.yml` with the matching release block before uploading. The pill's `disabled` guard is simply removed.

**Tech Stack:** Zod (schema), electron-updater (UpdateInfo payload), React + TypeScript (components), Node.js fs (upload script), pnpm workspace monorepo

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/contracts/src/app-update.ts` | Modify | Add `releaseNotes?: string` to `available` discriminant |
| `packages/contracts/src/app-update.test.ts` | Modify | Test new optional field |
| `apps/desktop/electron/auto-update-state.cjs` | Modify | Normalize + pass `releaseNotes` from UpdateInfo |
| `apps/desktop/src/components/writer/update-pill.tsx` | Modify | Remove `disabled`, fix gray cursor |
| `apps/desktop/src/components/writer/update-modal.tsx` | Modify | Render release notes block in `available` body |
| `CHANGELOG.md` | Create | Source of truth for release notes |
| `scripts/r2-upload.mjs` | Modify | Add `VERSION` const, `parseChangelog()`, patch `latest.yml` |

---

### Task 1: Extend the AppUpdateState contract

**Files:**
- Modify: `packages/contracts/src/app-update.ts`
- Modify: `packages/contracts/src/app-update.test.ts`

- [ ] **Step 1: Write failing tests**

Add two tests to `packages/contracts/src/app-update.test.ts` after the existing `available` test:

```ts
it("parses an available state with releaseNotes", () => {
  const s = parseAppUpdateState({ status: "available", version: "0.5.0", releaseNotes: "- Bug fixes" });
  expect(s).toEqual({ status: "available", version: "0.5.0", releaseNotes: "- Bug fixes" });
});

it("parses an available state without releaseNotes", () => {
  const s = parseAppUpdateState({ status: "available", version: "0.5.0" });
  expect(s).toEqual({ status: "available", version: "0.5.0" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd packages/contracts && pnpm vitest run src/app-update.test.ts
```

Expected: FAIL — first new test fails because Zod strips the unknown `releaseNotes` key (result has no `releaseNotes` property).

- [ ] **Step 3: Add releaseNotes to the schema**

Replace the full contents of `packages/contracts/src/app-update.ts` with:

```ts
import { z } from "zod";

export const appUpdateStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("idle") }),
  z.object({ status: z.literal("checking") }),
  z.object({ status: z.literal("available"), version: z.string().min(1), releaseNotes: z.string().optional() }),
  z.object({ status: z.literal("not-available") }),
  z.object({ status: z.literal("downloading"), percent: z.number().int().min(0).max(100) }),
  z.object({ status: z.literal("downloaded"), version: z.string().min(1) }),
  z.object({ status: z.literal("error"), message: z.string().min(1) })
]);

export type AppUpdateState = z.infer<typeof appUpdateStateSchema>;

export function parseAppUpdateState(payload: unknown): AppUpdateState {
  return appUpdateStateSchema.parse(payload);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd packages/contracts && pnpm vitest run src/app-update.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```
git add packages/contracts/src/app-update.ts packages/contracts/src/app-update.test.ts
git commit -m "feat(contracts): add optional releaseNotes to available AppUpdateState (WRI-223)"
```

---

### Task 2: Thread releaseNotes through the electron-updater mapper

**Files:**
- Modify: `apps/desktop/electron/auto-update-state.cjs`

Note: This is a pure CJS module (no Electron I/O). The change is verified by TypeScript compilation of downstream consumers (Task 4) and visual E2E testing.

- [ ] **Step 1: Replace the file contents**

```js
// Pure mapping from electron-updater events to AppUpdateState (see
// packages/contracts/src/app-update.ts). No Electron / no I/O.

/**
 * electron-updater's UpdateInfo.releaseNotes can be:
 *   - string
 *   - Array<{ version: string, note: string | null }>
 *   - null / undefined
 * Always returns a trimmed string or undefined.
 */
function normalizeReleaseNotes(raw) {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw.trim() || undefined;
  if (Array.isArray(raw)) {
    return raw.map(function (e) { return e.note || ""; }).filter(Boolean).join("\n\n") || undefined;
  }
  return undefined;
}

function mapUpdaterEvent(event, payload) {
  switch (event) {
    case "checking-for-update":
      return { status: "checking" };
    case "update-available": {
      const notes = normalizeReleaseNotes(payload.releaseNotes);
      return { status: "available", version: payload.version, ...(notes ? { releaseNotes: notes } : {}) };
    }
    case "update-not-available":
      return { status: "not-available" };
    case "download-progress":
      return { status: "downloading", percent: Math.floor(payload.percent) };
    case "update-downloaded":
      return { status: "downloaded", version: payload.version };
    case "error":
      return { status: "error", message: payload?.message || String(payload) };
    default:
      return { status: "idle" };
  }
}

module.exports = { mapUpdaterEvent };
```

- [ ] **Step 2: Verify TypeScript compiles (desktop package)**

```
cd apps/desktop && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```
git add apps/desktop/electron/auto-update-state.cjs
git commit -m "feat(desktop): thread releaseNotes from UpdateInfo through AppUpdateState mapper (WRI-223)"
```

---

### Task 3: Make the pill always clickable during download

**Files:**
- Modify: `apps/desktop/src/components/writer/update-pill.tsx`

- [ ] **Step 1: Replace the file contents**

Remove `disabled={isDownloading}` and the `isDownloading` const. Update `gray` variant to have hover + pointer cursor:

```tsx
import { ArrowUp, Loader2 } from "lucide-react";
import type { AppUpdateState } from "@writer/contracts";
import { cn } from "@/lib/utils";

export function pillLabel(state: AppUpdateState): string | null {
  switch (state.status) {
    case "available":   return "Upgrade";
    case "downloading": return "Downloading…";
    case "downloaded":  return "Update ready";
    case "error":       return "Update failed";
    default:            return null;
  }
}

export type PillVariant = "blue" | "gray" | "green" | "warning";

export function pillVariant(state: AppUpdateState): PillVariant | null {
  switch (state.status) {
    case "available":   return "blue";
    case "downloading": return "gray";
    case "downloaded":  return "green";
    case "error":       return "warning";
    default:            return null;
  }
}

const VARIANT_CLASSES: Record<PillVariant, string> = {
  blue:    "bg-[var(--writer-accent-blue)] text-[#e5f1ff] hover:opacity-90",
  gray:    "bg-white/10 text-[#e5f1ff]/50 hover:bg-white/15 cursor-pointer",
  green:   "bg-[#1a7a4a] text-white hover:bg-[#166040]",
  warning: "bg-[#7a3010]/80 text-[#ffb89a] hover:bg-[#7a3010]",
};

type UpdatePillProps = {
  state: AppUpdateState;
  onClick: () => void;
};

export function UpdatePill({ state, onClick }: UpdatePillProps) {
  const label = pillLabel(state);
  const variant = pillVariant(state);
  if (!label || !variant) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "self-center mr-2 flex items-center gap-1.5 rounded-full px-3 py-1",
        "text-xs font-medium tracking-wide transition-opacity",
        VARIANT_CLASSES[variant]
      )}
    >
      {state.status === "available"   && <ArrowUp size={11} strokeWidth={2.5} aria-hidden />}
      {state.status === "downloading" && <Loader2 size={11} className="animate-spin" aria-hidden />}
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Run existing pill tests**

```
cd apps/desktop && pnpm vitest run src/components/writer/update-pill.test.ts
```

Expected: All 12 existing tests PASS (helpers unchanged).

- [ ] **Step 3: Commit**

```
git add apps/desktop/src/components/writer/update-pill.tsx
git commit -m "fix(desktop): make update pill always clickable during download (WRI-223)"
```

---

### Task 4: Show release notes in the upgrade modal

**Files:**
- Modify: `apps/desktop/src/components/writer/update-modal.tsx`

- [ ] **Step 1: Update resolveBody — replace the available case**

In `update-modal.tsx`, replace `resolveBody` with the version below. The only change is the `available` case — the other cases are reproduced here in full so you can paste the whole function without risk of missing a brace:

```tsx
function resolveBody(s: AppUpdateState): ReactNode {
  const muted = "text-sm text-[#e5f1ff]/70";
  switch (s.status) {
    case "available":
      return (
        <div className="flex flex-col gap-3">
          {s.releaseNotes ? (
            <div className="rounded-lg bg-white/5 px-3 py-2.5 text-sm text-[#e5f1ff]/80 whitespace-pre-wrap leading-relaxed">
              {s.releaseNotes}
            </div>
          ) : (
            <p className={muted}>A new version of Writer is ready to download.</p>
          )}
          <p className="text-xs text-[#e5f1ff]/40">Your data and models will not be affected.</p>
        </div>
      );
    case "downloading":
      return (
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-valuenow={s.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Download progress"
            className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-[var(--writer-accent-blue)] transition-[width] duration-500 ease-linear"
              style={{ width: `${s.percent}%` }}
            />
          </div>
          <p className="text-xs text-[#e5f1ff]/50">{s.percent}%</p>
        </div>
      );
    case "downloaded":
      return <p className={muted}>Writer will restart and reopen automatically.</p>;
    case "error":
      return <p className={muted}>{s.message}</p>;
    default:
      return null;
  }
}
```

- [ ] **Step 2: Type-check**

```
cd apps/desktop && pnpm tsc --noEmit
```

Expected: No errors. TypeScript narrows `s` to the `available` variant inside the `case "available":` block, so `s.releaseNotes` is known as `string | undefined`.

- [ ] **Step 3: Commit**

```
git add apps/desktop/src/components/writer/update-modal.tsx
git commit -m "feat(desktop): show release notes in upgrade modal when available (WRI-223)"
```

---

### Task 5: Create CHANGELOG.md

**Files:**
- Create: `CHANGELOG.md` (repo root)

- [ ] **Step 1: Create the file**

```markdown
# Changelog

All notable changes to Writer desktop are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.5.0] - 2026-06-03
- Fixed "Not Responding" freeze during update install
- Retry logic for slow corporate DNS (3 attempts, 10 s apart)
- New update pill in title bar — click to check upgrade status
- Download progress visible in modal; dismiss and reopen anytime

## [0.4.0] - 2026-06-02
- Initial auto-update support via Cloudflare R2
- NSIS installer preserves all user data and models on update
```

- [ ] **Step 2: Commit**

```
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG.md with 0.5.0 release notes (WRI-223)"
```

---

### Task 6: Patch upload script to inject release notes

**Files:**
- Modify: `scripts/r2-upload.mjs` (intentionally untracked — do **not** `git add`)

- [ ] **Step 1: Replace the file contents**

```js
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
 * Returns the trimmed block string, or undefined if the version entry is missing.
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
  const yml = readFileSync(ymlPath, "utf8");
  const patched = yml.replace(/^(version:.+\n)/, `$1releaseNotes: ${JSON.stringify(notes)}\n`);
  writeFileSync(ymlPath, patched);
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
```

- [ ] **Step 2: Verify the CHANGELOG parser works (dry run, from repo root)**

```
node --input-type=module --eval "
import { readFileSync } from 'node:fs';
function parseChangelog(mdPath, version) {
  const text = readFileSync(mdPath, 'utf8');
  const start = text.indexOf('## [' + version + ']');
  if (start === -1) return undefined;
  const afterHeader = text.indexOf('\n', start) + 1;
  const nextSection = text.indexOf('\n## [', afterHeader);
  return text.slice(afterHeader, nextSection === -1 ? undefined : nextSection).trim() || undefined;
}
console.log(parseChangelog('CHANGELOG.md', '0.5.0'));
"
```

Expected output (the 0.5.0 bullet list):
```
- Fixed "Not Responding" freeze during update install
- Retry logic for slow corporate DNS (3 attempts, 10 s apart)
- New update pill in title bar — click to check upgrade status
- Download progress visible in modal; dismiss and reopen anytime
```

- [ ] **Step 3: Do NOT commit**

`scripts/r2-upload.mjs` is intentionally untracked. The file is ready to use when you next run a release. Remember to bump `VERSION` to match the built installer before running.
