# Verification Evidence — add-windows-auto-update-r2 (WRI-223)

Date: 2026-06-03

## Gates Run

### 6.1 Guard test — `apps/desktop/electron/auto-update.guard.test.ts`

Asserts that `auto-update.cjs` never references install-dir / resourcesPath write
paths or touches `~/.writer`.

Result: **PASS** — 1 test file, 1 test passed.

```
Test Files  1 passed (1)
     Tests  1 passed (1)
  Duration  354ms
```

### 6.2 Full desktop test suite

Command: `npm run test --workspace @writer/desktop`

Result: **PASS** — 29 test files, 134 tests passed (includes the new guard test and
the pre-existing `auto-update-state` unit tests).

```
Test Files  29 passed (29)
     Tests  134 passed (134)
  Duration  2.11s
```

### 6.3 Typecheck — all workspaces

Command: `npm run typecheck`

Result: **PASS** — 0 errors across all 8 workspaces
(`@writer/daemon`, `@writer/desktop`, `@writer/agent-adapters`,
`@writer/contracts`, `@writer/review-core`, `@writer/spreadsheet`,
`@writer/storage`, `@writer/tool-runtime`).

### 6.4 Full test suite — all workspaces

Command: `npm run test`

Result: **PASS for WRI-223 scope** — `@writer/desktop`, `@writer/contracts`,
`@writer/review-core`, `@writer/spreadsheet`, `@writer/storage`, and
`@writer/tool-runtime` all pass.

Two pre-existing failures are present in `@writer/daemon` and
`@writer/agent-adapters` (both assert `normalizeDevinModelId` falls back to
`swe-1.6` but the implementation now returns `gpt-5.4`). These failures exist on
the branch prior to any WRI-223 commits and are unrelated to the auto-update
feature.

### 6.5 OpenSpec validation

Command: `npx openspec validate add-windows-auto-update-r2 --type change --strict`

Result: **PASS**

```
Change 'add-windows-auto-update-r2' is valid
```

## Spec Verification (openspec-verify-change)

Date: 2026-06-03 — All automated checks completed post-implementation.

### Completeness: 15/16 tasks

Task 6.4 (manual A→B E2E) is the only incomplete item. It requires a packaged build
environment and a live R2 bucket — cannot be automated. All other tasks are complete.

### Correctness: 8/8 requirements covered

| Requirement | Implementation evidence |
|---|---|
| Production-only update checks | `auto-update.cjs:15` (`!app.isPackaged` guard) + `preload.cjs` (`isPackaged` flag) |
| Detect newer version from R2 | `electron-builder.yml:13-15` (generic provider, R2 URL) |
| User-initiated download with progress | `autoDownload: false`, Download button, `download-progress` event |
| Integrity verification | Delegated to `electron-updater` sha512 (library-level) |
| Restart to install | `auto-update.cjs` `quitAndInstall()` via `writer-update:restart` IPC |
| Preserve user data | `electron-builder.yml:87` (`deleteAppDataOnUninstall: false`) + guard test |
| Renderer through IPC only | `preload.cjs` contextBridge, no raw ipcRenderer |
| Safe publish ordering | `release-runbook.md` (installer → blockmap → `latest.yml` last) |

### Coherence: All 5 design decisions followed

D1 (electron-updater + NSIS + generic) ✓ · D2 (autoDownload=false, auto-check) ✓ ·
D3 (data in ~/.writer, deleteAppDataOnUninstall) ✓ · D4 (contextBridge, Zod contract) ✓ ·
D5 (production-only in main + preload) ✓

**Assessment: PASS — no blocking issues. Ready for retrospective and archive.**

---

## Task 6.4 — Manual A→B E2E (PENDING)

This gate cannot be automated. It requires:

1. A real packaged NSIS build of version A.
2. Uploading version B installer + `.blockmap` to the R2 bucket (package files
   first, then `latest.yml` last, per the release runbook).
3. Confirming version A detects version B, shows download progress, and restarts
   as version B.
4. Verifying `platform-store.json`, `~/.writer/logs`, and any `.gguf` model files
   are intact and the model is not re-downloaded.

Status: **PENDING** — requires a packaged build environment and a live R2 bucket.
See `release-runbook.md` for the step-by-step upload procedure.
