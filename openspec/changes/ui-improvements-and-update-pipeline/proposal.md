## Why

Several UX friction points and a silent update-pipeline bug were identified through
hands-on review of the live app. Users saw a frozen modal when clicking Upgrade, had
no guidance during long verification steps, lost download progress on navigation, and
received full 553 MB downloads even for icon-only changes because `blockMapSize` was
absent from the update feed — causing electron-updater to skip differential downloads
entirely. All issues are addressable with focused, low-risk changes to the renderer,
the Electron main-process event mapper, and the release upload script.

## What Changes

**Update modal — download state**
- From: Thin plain blue bar, percent-only label, "Later" button, freeze on Upgrade click
- To: Gradient progress bar (matches local model tile), `{percent}% · {x MB} / {y MB}` label, "Download in background" button, instant transition to downloading state
- Reason: Visual consistency + accurate labelling + no perceived freeze
- Impact: Non-breaking; renderer-only + contract extension

**Update modal — available state**
- From: No download size shown before committing to upgrade
- To: `{size} download · Your data and models will not be affected.`
- Reason: Informed consent before a potentially large download
- Impact: Non-breaking; adds optional `totalBytes` to `available` state contract

**Local model tile — verifying state**
- From: Spinner + "Verifying" badge only
- To: Spinner + badge + `InlineAlert kind="info"` explaining this can take a few minutes
- Reason: Prevents user from thinking the app has frozen during a long checksum step
- Impact: Non-breaking; renderer-only

**Local model tile — failed state**
- From: Retry button + "Failed" red badge (redundant)
- To: Retry button only; error detail in inline alert below
- Reason: Badge adds noise when the button already signals failure
- Impact: Non-breaking; renderer-only

**Figma OAuth reconnect**
- From: Polls every 2 s regardless of user focus; up to 2 s lag after returning from browser
- To: Polling sleep races against `window.focus`; reconnect triggers immediately when user returns
- Reason: Users expect instant feedback after completing OAuth
- Impact: Non-breaking; renderer-only

**Local model download progress persistence**
- From: `downloadProgress` is local component state; lost on navigation
- To: On mount, reads daemon state and resumes polling if download is in progress
- Reason: Navigating to another screen and back should not lose visibility of an ongoing download
- Impact: Non-breaking; renderer-only

**App icon**
- From: Default Electron atom icon in taskbar, Start Menu, and installer
- To: Custom `icon.ico` embedded in `Writer.exe` via `afterPack` rcedit hook
- Reason: Brand identity; `signAndEditExecutable: false` was blocking rcedit
- Impact: Non-breaking; build config only

**Update release pipeline**
- From: Regex `releaseNotes` patch (produces duplicates); no enforcement; no `blockMapSize`; full 553 MB download every update
- To: `js-yaml` round-trip patch; hard abort on missing changelog entry; `blockMapSize` injected from `.blockmap` file; differential block-level downloads active
- Reason: Prevents broken `latest.yml`; enforces release hygiene; eliminates unnecessary re-downloads of unchanged llama/CUDA binaries
- Impact: Non-breaking for users; release script change only

## Capabilities

### New Capabilities
- `update-modal-ux`: Download progress display, size disclosure, and optimistic state in the update available/downloading modal
- `local-model-tile-ux`: Verifying guidance and failed-state cleanup in the local model adapter tile
- `update-release-pipeline`: Release script hardening — enforced release notes, YAML correctness, differential update activation

### Modified Capabilities
- `figma-mcp-auth`: OAuth polling enhanced with `window.focus` early-wake

## Impact

**Files changed:**
- `packages/contracts/src/app-update.ts` — `available` + `downloading` state schema extensions
- `apps/desktop/electron/auto-update-state.cjs` + test — mapper extensions
- `apps/desktop/src/components/writer/update-modal.tsx` — UI changes
- `apps/desktop/src/shell/AppShell.tsx` — optimistic state on download
- `apps/desktop/src/agents-panel.tsx` — verifying alert, failed badge suppression, focus race, download resume on mount
- `apps/desktop/electron-builder.yml` — `afterPack` hook
- `apps/desktop/scripts/after-pack.cjs` — new rcedit hook
- `apps/desktop/build-resources/icon.ico` — new asset
- `scripts/r2-upload.mjs` — pipeline hardening

**No daemon changes. No new IPC channels. No new permissions.**
