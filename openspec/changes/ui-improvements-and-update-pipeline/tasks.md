## 1. Contract extensions

- [ ] 1.1 Add optional `totalBytes` to `available` state in `packages/contracts/src/app-update.ts`
- [ ] 1.2 Add optional `transferredBytes` and `totalBytes` to `downloading` state in `packages/contracts/src/app-update.ts`
- [ ] 1.3 Add contract tests for `available` with `totalBytes` and `downloading` with bytes in `app-update.test.ts`

## 2. Electron main-process mapper

- [ ] 2.1 Pass `payload.files[0]?.size` as `totalBytes` in `update-available` case in `auto-update-state.cjs`
- [ ] 2.2 Pass `payload.transferred` as `transferredBytes` and `payload.total` as `totalBytes` in `download-progress` case
- [ ] 2.3 Add mapper tests for both new fields in `auto-update-state.test.ts`

## 3. Update modal UI

- [ ] 3.1 Add `formatBytes` helper to `update-modal.tsx`
- [ ] 3.2 Replace thin progress bar with gradient two-div flex bar in `downloading` state
- [ ] 3.3 Update label to show `{percent}% · {transferred} / {total}` with bytes fallback
- [ ] 3.4 Rename "Later" → "Download in background" in `downloading` footer
- [ ] 3.5 Show `{totalBytes} download · …` line in `available` body when `totalBytes` is present
- [ ] 3.6 Set optimistic `{ status: "downloading", percent: 0 }` in `AppShell` `onDownload` and `onRetry` before calling `api.download()`

## 4. Local model tile UX

- [ ] 4.1 Add `isFailedState` derived variable and exclude it from badge render in `agents-panel.tsx`
- [ ] 4.2 Add `InlineAlert kind="info"` for `diagnostic.code === "verifying"` in the tile extra section
- [ ] 4.3 Extend mount `useEffect` to detect in-progress download via `getLocalModelStatus()` and resume polling
- [ ] 4.4 Add `useEffect` cleanup to set `downloadPollingActiveRef.current = false` on unmount

## 5. Figma OAuth polling

- [ ] 5.1 Replace `await sleep(2000)` with `Promise.race([sleep(2000), waitForWindowFocus()])` in `connectFigma` loop in `agents-panel.tsx`

## 6. App icon

- [ ] 6.1 Add `build-resources/icon.ico`
- [ ] 6.2 Add `afterPack: scripts/after-pack.cjs` to `electron-builder.yml`; keep `signAndEditExecutable: false`
- [ ] 6.3 Create `scripts/after-pack.cjs` that runs `rcedit.exe --set-icon` on `Writer.exe`

## 7. Release pipeline hardening

- [ ] 7.1 Replace regex `releaseNotes` patch with `js-yaml` parse/set/dump in `scripts/r2-upload.mjs`
- [ ] 7.2 Add `process.exit(1)` guard when `parseChangelog` returns `undefined`
- [ ] 7.3 Inject `blockMapSize` from `.blockmap` file size into each `doc.files` entry
- [ ] 7.4 Add `path` import (`dirname`, `join`) to support blockmap path resolution

## 8. Release and verification

- [ ] 8.1 Bump `package.json` version and `scripts/r2-upload.mjs` VERSION constant
- [ ] 8.2 Add changelog entry for the new version
- [ ] 8.3 Run `npm run build` and verify `• icon applied to Writer.exe` in build output
- [ ] 8.4 Run `node scripts/r2-upload.mjs` and confirm `blockMapSize` is present in the uploaded `latest.yml`
- [ ] 8.5 Trigger update check in the installed app and verify release notes + size are displayed
