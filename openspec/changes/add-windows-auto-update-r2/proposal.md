## Why

Writer is handed to coworkers as a Windows Electron build, and today every new
version must be downloaded and reinstalled by hand. WRI-223 asks for an in-app
auto-update flow so an installed app can detect, download, and install newer
versions from a Cloudflare R2 static HTTPS directory — without a custom update
server and without exposing Cloudflare credentials in the app.

This change delivers the first internal proof-of-concept slice: a minimal,
end-to-end update loop on Windows, with an explicit guarantee that user data, logs,
and local LLM model files are preserved across updates.

## What Changes

**In-app Windows update flow**
- From: Coworkers manually download and reinstall each new Writer build.
- To: An installed packaged build checks an R2 generic update feed on launch,
  surfaces an available version, downloads it on user action, and restarts to
  install.
- Reason: Internal users should receive UI/feature/code updates from inside the app.
- Impact: Adds an Electron main-process updater module, preload IPC, a small
  renderer affordance, and Windows packaging/publish configuration.

**Packaging and publish target**
- From: `electron-builder --win --x64` with no update target or publish config.
- To: NSIS Windows target with a `generic` publish provider pointing at the R2
  update directory, generating `latest.yml` + installer + `.blockmap`.
- Reason: `electron-updater`'s generic provider is the mechanism that consumes a
  static R2 HTTPS directory; NSIS supports unsigned self-update on Windows.
- Impact: Adds `electron-updater` to `apps/desktop`; defines the build/publish
  config; documents a manual R2 upload runbook (package files first, metadata last).

**Data-survival invariant**
- From: Update behavior relative to user data is unspecified.
- To: The updater and installer MUST NOT touch anything under `~/.writer`
  (user records, logs, local models). Verified intact across an A→B update.
- Reason: Explicit user requirement; prevents data loss and avoids re-downloading
  multi-GB model files.
- Impact: Adds a guard test and a manual data-survival acceptance step; sets NSIS
  `deleteAppDataOnUninstall: false` as belt-and-suspenders.

## Capabilities

### New Capabilities

- `desktop-auto-update`: production-only Windows update checks against an R2 generic
  feed, user-initiated download with progress, restart-to-install, integrity
  verification, and preservation of user data, logs, and local model files.

## Impact

- `apps/desktop`: new main-process updater module (`electron/auto-update.cjs`),
  preload `window.writerUpdate` bridge, a minimal renderer Update affordance,
  electron-builder NSIS + generic publish config, `electron-updater` dependency.
- `packages/contracts`: an update-state schema (discriminated union over the update
  lifecycle) shared by main and renderer.
- Release process: documented manual R2 upload ordering (package artifacts before
  `latest.yml`).

Non-goals for this slice: custom update server, GitHub Releases source, embedded
Cloudflare tokens, updating local model binaries via the installer, Windows code
signing, publish/release automation, and polished update UX. macOS/Linux
auto-update are out of scope (Windows only).
