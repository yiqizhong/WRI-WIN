## 1. Contracts

- [x] 1.1 Inspect current `electron-builder` config, `apps/desktop/electron/main.cjs` window load, the preload bridge, and `ensure-daemon.cjs` resource paths before adding update code.
- [x] 1.2 Add an update-state contract in `packages/contracts`: a Zod discriminated union over `idle | checking | available | downloading | downloaded | error` with `version`, `percent`, and `message` fields; export the inferred type. (validate: `npm run typecheck`)

## 2. Packaging and publish config

- [x] 2.1 Add `electron-updater` as a dependency of `apps/desktop`.
- [x] 2.2 Add electron-builder Windows config: `target: nsis`, `x64`, `deleteAppDataOnUninstall: false`, and `publish: { provider: "generic", url: <R2 base URL> }` so builds generate `latest.yml` + installer + `.blockmap` and bake `app-update.yml` into the package.
- [x] 2.3 Document the manual R2 upload runbook in the change: upload the installer and `.blockmap` first, then `latest.yml` last.

## 3. Main-process updater module

- [x] 3.1 Add `apps/desktop/electron/auto-update.cjs` wrapping `electron-updater`'s `autoUpdater` with `autoDownload: false` and `autoInstallOnAppQuit: false`, all wiring guarded by `app.isPackaged` (no-op in dev).
- [x] 3.2 Map `autoUpdater` events (`checking-for-update`, `update-available`, `update-not-available`, `download-progress`, `update-downloaded`, `error`) to the update-state contract and forward to the renderer over IPC; register IPC handlers for `check`, `download`, and `restartToInstall` (`quitAndInstall`).
- [x] 3.3 Trigger exactly one auto-check on packaged app launch.
- [x] 3.4 Ensure the module never writes under `app.getAppPath()` / `process.resourcesPath` and never touches `~/.writer` (the data-survival invariant).

## 4. Preload IPC

- [x] 4.1 Expose `window.writerUpdate` via `contextBridge` with `check()`, `download()`, `restartToInstall()`, and `onState(cb)`; do not expose raw `ipcRenderer` to the renderer.

## 5. Renderer UI

- [x] 5.1 Add a minimal Update affordance (Settings / status area) that reflects `idle | checking | available(vX) | downloading(%) | downloaded | error` and offers Download and Restart actions.
- [x] 5.2 Subscribe to `window.writerUpdate.onState`, drive the buttons from state, and render the affordance only in packaged builds.

## 6. Verification

- [x] 6.1 Add Vitest unit tests for the event→state mapping using a mocked `autoUpdater`, covering progress, `not-available`, and `error`.
- [x] 6.2 Add a guard test asserting the updater module references no install-dir / `resourcesPath` write paths and performs no `~/.writer` writes.
- [x] 6.3 Run `npm run typecheck`, `npm run test`, and `npx openspec validate add-windows-auto-update-r2 --type change --strict`.
- [ ] 6.4 Manual A→B E2E: build vA → install → create a record, write a log line, confirm a `.gguf` in `~/.writer/models`; upload vB to R2 (package files first, `latest.yml` last); confirm vA detects vB, downloads with progress, restarts, and relaunches as vB; assert `platform-store.json`, `~/.writer/logs`, and the model file are intact and the model is not re-downloaded.
