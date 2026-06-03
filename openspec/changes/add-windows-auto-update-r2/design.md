## Context

Writer is a local-first Electron desktop app (renderer + privileged daemon + shared
contracts + local storage). Distribution today is manual: coworkers download and
reinstall each Windows build. WRI-223 asks for an in-app auto-update flow sourced
from a Cloudflare R2 static HTTPS directory.

The repo already uses `electron-builder` (`apps/desktop`, `build:app` →
`electron-builder --win --x64`). `electron-updater` is not yet a dependency. The
main window already distinguishes dev vs prod loading
(`apps/desktop/electron/main.cjs:22`: `if (app.isPackaged) loadFile(dist/index.html)`),
so the "load bundled UI in prod" acceptance criterion is already satisfied and only
needs verification.

This is a thin proof-of-concept slice. Auto-update is an Electron main-process
concern and respects the existing renderer/privileged boundary: the renderer only
requests update actions over preload IPC; the main process performs all privileged
update work. The daemon is not involved.

Affected areas:

- `apps/desktop` (electron main, preload, renderer): updater module, IPC bridge,
  Update affordance, packaging/publish config.
- `packages/contracts`: shared update-state schema.
- Release process: documented manual R2 upload ordering.

## Goals / Non-Goals

**Goals:**

- A packaged Windows build checks an R2 generic feed on launch and detects a newer
  version.
- The user can download an available update and see progress.
- The user can restart to install; the app relaunches as the new version.
- User data, logs, and local LLM model files survive the update untouched and the
  model is not re-downloaded.
- No update activity in development.
- Publishing uploads package artifacts before update metadata.

**Non-Goals:**

- Custom update server or GitHub Releases source.
- Embedding Cloudflare API tokens in the app.
- Updating local model binaries through the installer.
- Windows code signing (unsigned acceptable for the first internal test).
- Publish/release automation and polished update UX.
- macOS / Linux auto-update (Windows only for this slice).

## Decisions

### D1: `electron-updater` + NSIS + generic provider

- **Choice:** Use the `electron-updater` package with an NSIS Windows target and a
  `generic` publish provider pointing at the R2 update directory.
- **Rationale:** The generic provider consumes a static HTTPS directory
  (`latest.yml` + installer + `.blockmap`) exactly as R2 serves it; NSIS supports
  unsigned self-update on Windows and produces the artifacts `electron-updater`
  expects.
- **Alternatives considered:** Electron built-in `autoUpdater` (Squirrel.Windows) —
  rejected: needs a `RELEASES` feed, does not fit an R2 generic directory.
  Hand-rolled fetch-and-spawn — rejected for now: reinvents checksum verification,
  blockmap, and staged install; kept as a fallback only if `electron-updater` fails
  on unsigned builds.

### D2: Auto-check on launch, manual download and restart

- **Choice:** `autoDownload: false`. Check once on packaged launch; the user clicks
  Download (progress shown) and then Restart to install.
- **Rationale:** The user wants visible control with minimal friction. Two explicit
  actions, no surprise restarts.
- **Alternatives considered:** Fully automatic download + restart prompt (more
  hands-off, less control); fully manual check button (more clicks). Both rejected
  for the chosen middle ground.

### D3: Data lives outside the install dir (preserve-by-architecture)

- **Choice:** Rely on the existing `~/.writer` data root and add a hard invariant
  that the updater/installer never touch it. Set NSIS `deleteAppDataOnUninstall:
  false` as belt-and-suspenders.
- **Rationale:** `getDefaultDataDir()` → `~/.writer` (`packages/storage/src/store.ts:82`)
  holds records (`platform-store.json`), logs (`~/.writer/logs`), and models
  (`~/.writer/models`). An NSIS per-user update overwrites only the install dir,
  which is invisible to these paths. The only install-dir writes are read-only
  bundled binaries (`resourcesPath/daemon`, `resourcesPath/llama`) meant to be
  replaced.
- **Alternatives considered:** Migrate data into Electron `userData` — rejected:
  unnecessary churn and risk; current location is already safe.

### D4: Renderer drives updates only through a typed preload bridge

- **Choice:** Expose `window.writerUpdate` via `contextBridge` with `check()`,
  `download()`, `restartToInstall()`, and `onState(cb)`. No raw `ipcRenderer` in the
  renderer. Update state is a shared Zod contract in `packages/contracts`.
- **Rationale:** Matches the repo's renderer/privileged boundary and contracts-first
  convention; keeps the renderer dumb and testable.

### D5: Production-only updater wiring

- **Choice:** Guard all updater wiring behind `app.isPackaged`. In dev, the module
  is a no-op and the renderer affordance is hidden.
- **Rationale:** Acceptance criterion; avoids update checks against R2 during local
  development with the Vite dev server.

## Update state machine

Single discriminated union, emitted by main → renderer:

```text
idle
  -> checking            (on launch, packaged only)
  -> available {version} | not-available
available -> (user Download) downloading {percent}
downloading -> downloaded | error {message}
downloaded -> (user Restart) quitAndInstall -> relaunch as new version
any -> error {message}   (network/R2 unreachable, integrity failure)
```

`electron-updater` events map directly: `checking-for-update`, `update-available`,
`update-not-available`, `download-progress`, `update-downloaded`, `error`.
Integrity is verified by `electron-updater` via the sha512 in `latest.yml`; a
mismatch surfaces as `error` and the user may retry.

## Risks / Trade-offs

[Risk] Unsigned builds trigger SmartScreen / unknown-publisher warnings on first
install. -> Mitigation: out of updater scope for the PoC; noted for the tester.
Long-term rollout should add company code signing.

[Risk] `electron-updater` may refuse to apply an unsigned update in some
configurations. -> Mitigation: validate the A→B loop early; fall back to D1's
hand-rolled approach only if blocked.

[Risk] A future code change could start writing user data into the install dir,
silently breaking the invariant. -> Mitigation: guard test asserting the updater
module references no `app.getAppPath()`/`resourcesPath` write paths and no
`~/.writer` writes.

[Risk] Manual R2 upload in the wrong order (metadata before package) would point
clients at a missing binary. -> Mitigation: documented runbook — upload installer +
`.blockmap` first, `latest.yml` last; acceptance criterion.

[Trade-off] Manual upload and no signing keep the PoC small but are not the
long-term release story. -> Accepted; deferred to follow-up changes.

## Migration Plan

1. Add the shared update-state contract in `packages/contracts`.
2. Add electron-builder NSIS target + generic publish config; add `electron-updater`.
3. Add the main-process updater module guarded by `app.isPackaged`; map events to
   the contract and register IPC handlers; auto-check on launch.
4. Add the preload `window.writerUpdate` bridge.
5. Add the minimal renderer Update affordance.
6. Verify: unit tests, guard test, typecheck, strict validate, and the manual A→B
   data-survival E2E.

Rollback strategy: do not register the updater module and hide the renderer
affordance; the app behaves exactly as before. No data migration is involved.

Acceptance:

- `npm run typecheck`
- `npm run test`
- `npx openspec validate add-windows-auto-update-r2 --type change --strict`
- Manual A→B evidence: build vA → install → create a record, write a log line,
  confirm a `.gguf` in `~/.writer/models` → upload vB to R2 (package first,
  `latest.yml` last) → confirm vA detects, downloads, restarts, and relaunches as
  vB → assert records, logs, and the model file are intact and the model is not
  re-downloaded.
