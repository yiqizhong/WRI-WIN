Brainstorm capture for `add-windows-auto-update-r2` (Linear: WRI-223).

Produced via `superpowers:brainstorming` (one question at a time, design approved before artifacts).

## Background

Writer is distributed as a Windows Electron desktop app. Today coworkers must
manually download each new build. WRI-223 asks for an in-app auto-update flow so
an installed app can detect, download, and install newer versions from a
Cloudflare R2 static HTTPS directory.

The repo already uses `electron-builder` (`apps/desktop`, `build:app` →
`electron-builder --win --x64`). `electron-updater` is not yet a dependency. The
referenced design doc `docs/architecture/windows-electron-auto-update-r2.md` does
not exist in the repo (the ticket cites a macOS path); this change supersedes that
dangling reference.

## Decision chain (one question at a time)

### Q1: How much of WRI-223 lands in the first change?

Decision: **Thin PoC slice.** Minimum end-to-end loop — package as NSIS, point at
R2, detect → download → restart-install, with simple update states. Matches the
ticket's own "first internal proof of concept" framing. Polished UX, code signing,
and release automation are deferred.

### Q2: Which update mechanism?

Decision: **`electron-updater` + NSIS target + `generic` provider.** This is the
standard fit for R2 static hosting: it generates `latest.yml` + `.blockmap`, can
self-update unsigned builds on Windows, and supports `autoDownload: false` for a
manual-download UX.

Rejected: Electron's built-in `autoUpdater` (Squirrel.Windows) — needs a `RELEASES`
feed and does not cleanly consume an R2 generic directory. This is the ambiguity in
the ticket's "Electron automatic updates" wording. Also rejected: a hand-rolled
fetch-and-spawn updater — reinvents checksum verification, blockmap, and staged
install; kept only as a fallback if `electron-updater` fights us on unsigned builds.

### Q3: What is the R2 readiness, and how do builds get published?

Decision: **Bucket exists with a public read URL.** The change only wires that URL
into electron-builder's `generic` publish config. For the PoC, uploads are manual
(R2 dashboard / wrangler), out of band. Publish automation is deferred.

### Q4: How automatic should the update flow be?

Decision: **Auto-check on launch (packaged only), manual download + manual restart.**
On launch the app silently checks R2 and surfaces "Update available (vX)". The user
clicks Download (sees progress), then clicks Restart to install. Two explicit user
actions; `autoDownload: false`.

### Q5 (hard requirement raised by user): Data survival

User requirement: when the app updates, **user data, logs, and local LLM model data
must be preserved — never cleaned.**

Verified against the repo — these already live OUTSIDE the install dir, so an NSIS
per-user update physically cannot reach them. Single source of truth:
`getDefaultDataDir()` → `~/.writer` (`packages/storage/src/store.ts:82`).

| Data class | Location |
|---|---|
| User records / main store | `~/.writer/platform-store.json` (`store.ts:94`) |
| Conversations / sessions / screenshots | `~/.writer/conversations`, `~/.writer/sessions` |
| Logs | `~/.writer/logs` (`apps/daemon/src/config.ts:40`) |
| Local LLM models | `~/.writer/models` (`apps/daemon/src/local-models.ts:19`) |
| Guidelines / MCP auth / workspace | `~/.writer/...` |

The only things written under the install dir are read-only bundled binaries
(`resourcesPath/daemon`, `resourcesPath/llama`, `apps/desktop/electron/ensure-daemon.cjs:172`),
which are meant to be replaced on update. This requirement is therefore promoted to
a first-class invariant (below) plus explicit acceptance criteria.

## Invariant

The updater and installer MUST NOT write to, move, or delete anything under
`~/.writer`. No new code in this change may persist user data, logs, or model files
inside the install dir or `resourcesPath`.

## Boundaries

Auto-update is a desktop-shell / Electron main-process concern, not a daemon
concern. It respects the existing renderer/privileged boundary: the renderer only
requests actions over preload IPC; the main process performs all privileged update
work.

## V1 acceptance (PoC)

- Version A installed on Windows detects version B from the R2 generic feed.
- App surfaces "update available", downloads on user action with visible progress,
  and restarts to install on user action.
- After update the app relaunches as version B.
- `~/.writer` user records, logs, and `.gguf` model files are intact after update,
  and the model is not re-downloaded.
- No update activity runs in development (`app.isPackaged` guard).
- Publishing uploads package artifacts before `latest.yml`.

## Out of scope (deferred)

- Custom update server; GitHub Releases as the source.
- Embedding Cloudflare API tokens in the app.
- Updating local model binaries through the installer.
- Windows code signing (unsigned acceptable for the first internal test; may trigger
  SmartScreen / unknown-publisher warnings).
- Release/publish automation and polished update UX.
