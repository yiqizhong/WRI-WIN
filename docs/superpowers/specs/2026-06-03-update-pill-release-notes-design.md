# Update Pill Click-Through + Release Notes — Design

**Date:** 2026-06-03
**Ticket:** WRI-223 (Windows auto-update)
**Scope:** Two UX improvements to the existing update pill + modal system.

---

## 1. Problem

1. **Pill locked during download.** The "Downloading…" pill is `disabled`, so users who dismiss the progress modal have no way to re-open it mid-download.
2. **Modal lacks context.** The upgrade modal says only "A new version is ready to download" — no information about what changed.

---

## 2. Approach

**Approach A — thread `releaseNotes` through `AppUpdateState`; patch `latest.yml` from `CHANGELOG.md` at upload time.**

- `releaseNotes` travels with the state object so it is available everywhere the state is consumed, with no extra fetches or build-time injections.
- `CHANGELOG.md` is the single source of truth; the upload script extracts the relevant block automatically.

---

## 3. Design

### 3.1 Contract (`packages/contracts/src/app-update.ts`)

Add `releaseNotes` as an optional string on the `available` discriminant:

```ts
z.object({
  status: z.literal("available"),
  version: z.string().min(1),
  releaseNotes: z.string().optional(),
})
```

Existing `available` payloads without the field remain valid (zod `.optional()`).

---

### 3.2 Electron-updater mapper (`apps/desktop/electron/auto-update-state.cjs`)

electron-updater's `UpdateInfo.releaseNotes` is `string | Array<{version, note}> | null`. Add a normalizer that always produces `string | undefined`:

```js
function normalizeReleaseNotes(raw) {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw.trim() || undefined;
  if (Array.isArray(raw)) return raw.map(e => e.note || "").filter(Boolean).join("\n\n") || undefined;
}
```

In the `update-available` case:

```js
case "update-available": {
  const notes = normalizeReleaseNotes(payload.releaseNotes);
  return { status: "available", version: payload.version, ...(notes ? { releaseNotes: notes } : {}) };
}
```

---

### 3.3 CHANGELOG.md (repo root)

Create using [Keep a Changelog](https://keepachangelog.com) format. Each release gets a `## [x.y.z] - YYYY-MM-DD` header followed by bullet points:

```markdown
## [0.5.0] - 2026-06-03
- Fixed "Not Responding" freeze during install
- Retry logic for slow corporate DNS (3 attempts, 10 s apart)
- New update pill in title bar — click to check upgrade status
- Download progress visible in modal; dismiss and reopen anytime
```

---

### 3.4 Upload script (`scripts/r2-upload.mjs`)

Before uploading `latest.yml`, extract the matching block from `CHANGELOG.md` and inject it:

```js
// Add readFileSync + writeFileSync to the existing fs import:
import { createReadStream, statSync, readFileSync, writeFileSync } from "node:fs";

// Define VERSION as a top-level constant (e.g. "0.5.0") to DRY up the filename strings:
const VERSION = "0.5.0";

function parseChangelog(mdPath, version) {
  const text = readFileSync(mdPath, "utf8");
  const start = text.indexOf(`## [${version}]`);
  if (start === -1) return undefined;
  const afterHeader = text.indexOf("\n", start) + 1;
  const nextSection = text.indexOf("\n## [", afterHeader);
  const block = text.slice(afterHeader, nextSection === -1 ? undefined : nextSection).trim();
  return block || undefined;
}

// After building, before uploading latest.yml:
const notes = parseChangelog("CHANGELOG.md", VERSION);
if (notes) {
  const yml = readFileSync(`${DIST}/latest.yml`, "utf8");
  const patched = yml.replace(/^(version:.+\n)/, `$1releaseNotes: ${JSON.stringify(notes)}\n`);
  writeFileSync(`${DIST}/latest.yml`, patched);
}
```

If no matching entry is found, `latest.yml` is uploaded unchanged — the modal falls back gracefully.

---

### 3.5 Pill (`apps/desktop/src/components/writer/update-pill.tsx`)

Two changes:

1. Remove `disabled={isDownloading}` — pill is always clickable.
2. Gray variant gains hover feedback and correct cursor:

```ts
gray: "bg-white/10 text-[#e5f1ff]/50 hover:bg-white/15 cursor-pointer",
```

---

### 3.6 Modal (`apps/desktop/src/components/writer/update-modal.tsx`)

`resolveBody` for `available` state:

```tsx
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
```

When `releaseNotes` is absent, the generic fallback is shown — no breakage for users on old `latest.yml` files.

---

## 4. Error handling / edge cases

| Scenario | Behaviour |
|---|---|
| `latest.yml` has no `releaseNotes` | Modal shows generic fallback copy |
| `CHANGELOG.md` missing entry for version | Upload script skips patching; `latest.yml` uploaded as-is |
| `releaseNotes` is an array (future electron-updater) | `normalizeReleaseNotes` joins entries with blank lines |
| User dismisses modal mid-download | Pill is still clickable → re-opens modal showing live progress |

---

## 5. Files changed

| File | Change |
|---|---|
| `packages/contracts/src/app-update.ts` | Add `releaseNotes?: string` to `available` |
| `apps/desktop/electron/auto-update-state.cjs` | Normalize + pass `releaseNotes` |
| `scripts/r2-upload.mjs` | Parse `CHANGELOG.md`, patch `latest.yml` |
| `CHANGELOG.md` | Create at repo root |
| `apps/desktop/src/components/writer/update-pill.tsx` | Remove `disabled`, fix gray cursor |
| `apps/desktop/src/components/writer/update-modal.tsx` | Render `releaseNotes` block in `available` body |

No new dependencies. No schema migrations. Backward-compatible.
