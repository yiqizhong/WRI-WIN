## Context

Writer desktop is an Electron app (renderer + daemon + agent runtime) for auditing UX
copy in Figma. This change addresses UX rough edges and update-pipeline bugs found
during live review of the shipped app.

**Current state before this change:**
- Update modal: plain thin progress bar, only shows percent, freezes on Upgrade click,
  "Later" button during download misleads users into thinking the download will be
  deferred rather than just moved to background.
- Local model tile: no guidance during verification (can take minutes); redundant
  "Failed" badge shown alongside a Retry button.
- Figma OAuth: up to 2 s lag after user returns from browser before the UI updates.
- Download progress: lost on navigation (local component state, not reconnected on mount).
- App icon: default Electron atom shown everywhere; custom icon not embedded due to
  `signAndEditExecutable: false` blocking `rcedit`.
- Update feed: YAML patching produced duplicate `releaseNotes` keys; no enforcement
  of release notes at publish time; `blockMapSize` absent → full 553 MB download
  even for icon-only changes.

**Constraints:**
- No code-signing certificate available on the build machine.
- Renderer must not reach daemon directly for privileged operations.
- `signAndEditExecutable: false` must remain to avoid `winCodeSign` symlink failure
  (requires admin privileges not available in the build environment).

---

## Goals / Non-Goals

**Goals:**
- Update modal download state uses the gradient progress bar already established in
  the local model tile (visual consistency).
- Show transferred + total bytes in the download label.
- Eliminate the freeze between "Upgrade" click and the first `download-progress` event.
- Replace "Later" with "Download in background" (accurate label).
- Show download size before the user commits to upgrading.
- Inform user during local model verification that it may take a few minutes.
- Remove redundant "Failed" badge when Retry button is already present.
- Figma OAuth reconnect triggers immediately on `window.focus` rather than waiting for
  the next poll tick.
- Restore in-progress local model download display when navigating back to the
  Agents screen.
- Embed the custom app icon in `Writer.exe` without requiring code signing or admin.
- Enforce release notes at publish time (abort upload if missing).
- Activate differential block-level updates so unchanged llama/CUDA binaries are never
  re-downloaded.

**Non-Goals:**
- Replacing the NSIS installer with a zip-based update format.
- Separating llama/CUDA into a side-car download (separate change).
- Code signing / notarisation.
- Linux or macOS packaging (Windows-only repo).

---

## Decisions

### D1: Gradient progress bar in update modal
- **Choice:** Reuse the two-div flex pattern from the local model tile
  (`bg-[linear-gradient(to_right,#3b4df2,#bafde6,white)]` fill + `bg-[#666]` remainder,
  `h-[3.8px]`, flex ratio drives width).
- **Rationale:** Identical treatment across both download surfaces avoids a second
  progress-bar component and gives the app visual consistency.
- **Alternative considered:** Keep the existing `h-1.5 overflow-hidden rounded-full`
  bar and just add bytes. Rejected: different visual language in the same app.

### D2: Optimistic downloading state on Upgrade click
- **Choice:** In `AppShell`, set `updateState = { status: "downloading", percent: 0 }`
  synchronously in `onDownload` before calling `api.download()`.
- **Rationale:** electron-updater may take several seconds before firing the first
  `download-progress` event (DNS, connection setup). The optimistic state eliminates
  the freeze without any contract or backend changes.
- **Alternative considered:** Reduce the polling interval inside electron-updater.
  Rejected: not configurable without forking the library.

### D3: Thread `transferredBytes` + `totalBytes` through the contract
- **Choice:** Add optional `transferredBytes` and `totalBytes` to the `downloading`
  state in `AppUpdateState`; map from `payload.transferred` / `payload.total` in
  `auto-update-state.cjs`.
- **Rationale:** electron-updater's `ProgressInfo` already provides these fields.
  Passing them through the existing contract/mapper path keeps the renderer pure
  (receives typed state, no direct IPC).

### D4: Thread `totalBytes` through the `available` state
- **Choice:** Add optional `totalBytes` to the `available` state in `AppUpdateState`;
  map from `payload.files[0]?.size` in `auto-update-state.cjs`.
- **Rationale:** The installer size is known at the point the update-available event
  fires. Showing it in the modal before the user clicks Upgrade gives informed consent.

### D5: `window.focus` race in Figma OAuth polling
- **Choice:** `Promise.race([sleep(2000), waitForFocus()])` where `waitForFocus` adds a
  one-shot `window.addEventListener("focus", resolve)`.
- **Rationale:** The user switches back to Writer immediately after completing OAuth in
  the browser. Racing the sleep against focus reduces worst-case lag from ≤2 s to
  ~50 ms (one `listMcpServers` round-trip).
- **Alternative considered:** Reduce poll interval to 500 ms. Rejected: adds 4× backend
  load during a user-initiated OAuth flow; focus event is more precise.

### D6: Resume local model download progress on mount
- **Choice:** Extend the existing `getLocalModelStatus` `useEffect` in `AgentsPanel`:
  if the returned status is `"downloading"`, set `downloadProgress` and start a fresh
  polling loop. `useEffect` cleanup sets `downloadPollingActiveRef.current = false` to
  stop polling on unmount.
- **Rationale:** The daemon always has the ground truth. Reconnecting on mount avoids
  promoting the state to the workspace context (which would require API surface changes
  and re-renders across screens that don't need it).
- **Alternative considered:** Lift `downloadProgress` into `WorkspaceContext`. Rejected:
  over-reach for a display-only concern; polling ownership stays in the panel.

### D7: App icon via `afterPack` rcedit hook
- **Choice:** Add `afterPack: scripts/after-pack.cjs` to `electron-builder.yml`.
  The hook calls `electron-winstaller/vendor/rcedit.exe` on `Writer.exe` with
  `--set-icon build-resources/icon.ico`. Keep `signAndEditExecutable: false`.
- **Rationale:** Removing `signAndEditExecutable: false` causes electron-builder to
  attempt code signing, which downloads `winCodeSign` and fails to extract it due to
  a symlink creation error (requires admin). `afterPack` runs rcedit independently,
  decoupling icon embedding from signing.
- **Alternative considered:** Remove `signAndEditExecutable: false` entirely. Rejected:
  fails build on the current machine.

### D8: `js-yaml` parse/set/dump for `latest.yml` patching
- **Choice:** Load the YAML document, set `doc.releaseNotes = notes`, dump back with
  `{ lineWidth: -1 }`.
- **Rationale:** Regex replacement blindly inserts after the version line, producing a
  duplicate key if electron-builder already emits `releaseNotes`. YAML round-trip
  replaces correctly regardless of field order.

### D9: Enforce release notes at upload time
- **Choice:** `process.exit(1)` with a clear error message if `parseChangelog` returns
  `undefined`. Upload never starts.
- **Rationale:** Silent skip allowed v0.6.0 to ship without notes. Hard fail makes the
  invariant impossible to accidentally violate.

### D10: Inject `blockMapSize` into `latest.yml`
- **Choice:** For each entry in `doc.files`, set `file.blockMapSize` from
  `statSync(join(distDir, file.url + ".blockmap")).size` if not already present.
- **Rationale:** electron-updater checks this field before attempting differential
  downloads. Without it the full 553 MB installer is fetched on every update regardless
  of what changed. With it, only changed 64 KB blocks are downloaded; the unchanged
  llama/CUDA blocks are reconstructed from the locally cached installer.
- **Alternative considered:** Switch to `zip` update format (better differential support
  out of the box). Rejected: requires reworking the installer and first-run experience;
  out of scope.

---

## Risks / Trade-offs

- **[Risk] First install has no cached blockmap** → Differential download only activates
  for updates from a version that was itself installed via the in-app updater. A fresh
  NSIS install creates no local blockmap cache. Mitigation: acceptable for first
  install; all subsequent updates are differential.

- **[Risk] `rcedit.exe` path coupling** → `after-pack.cjs` resolves rcedit relative to
  `electron-winstaller` in node_modules. If that package is removed or restructured the
  hook silently stops applying the icon. Mitigation: the hook throws on failure so the
  build will fail loudly rather than silently ship without an icon.

- **[Trade-off] `window.focus` race** → If the user never focuses the window (e.g.,
  the OAuth callback is handled by a background process), the poll falls back to the
  2 s tick. Accepted: the common case (user manually closes the browser tab and clicks
  Writer) is fully covered.

- **[Trade-off] Optimistic downloading state** → If `api.download()` fails immediately,
  the UI briefly shows the download state before reverting to the error state.
  Accepted: the error state is shown correctly once the event fires; the brief flash
  is imperceptible.

- **[Trade-off] `totalBytes` as "download size"** → Shows full installer size even
  when differential download will transfer much less. Accepted: the true differential
  size isn't known until the blockmap is fetched; showing full size is a conservative
  upper bound. Will be re-evaluated once differential downloads are confirmed working.

---

## Migration Plan

All changes are client-side only. Deployment:
1. Merge `feat/ui-ux-improvements` into `main`.
2. Bump version in `package.json` and `scripts/r2-upload.mjs`.
3. Add changelog entry for the version.
4. `npm run build` in `apps/desktop`.
5. `node scripts/r2-upload.mjs` (with `R2_KEY_ID` / `R2_SECRET` env vars).

Rollback: re-upload the previous version's `latest.yml` to R2. The installer files for
previous versions remain on R2 (versioned keys) and are not overwritten.

---

## Open Questions

- Should `totalBytes` in the available state modal show the estimated differential size
  instead of the full installer size? (Requires knowing the local blockmap size upfront,
  which would need IPC from the renderer to the electron main process.)
- Should llama/CUDA be separated into a side-car download to eliminate the 553 MB base
  installer entirely? (Separate change, significant scope.)
