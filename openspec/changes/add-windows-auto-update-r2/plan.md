# Windows Electron Auto-Update via R2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A packaged Windows Writer build checks a Cloudflare R2 generic feed on launch, lets the user download a newer version and restart to install, while user data, logs, and local model files under `~/.writer` survive untouched.

**Architecture:** Auto-update is Electron main-process work via `electron-updater` (NSIS target, `generic` provider → R2). A pure event→state mapper is unit-tested; thin Electron wiring forwards state to the renderer over a typed `window.writerUpdate` preload bridge. The renderer is dumb: it renders state and triggers `check`/`download`/`restart`. `autoDownload: false` gives auto-check + manual download + manual restart. All wiring is guarded by `app.isPackaged`.

**Tech Stack:** TypeScript, Zod 4 (`packages/contracts`), Electron 39 main/preload (CommonJS `.cjs`), `electron-updater`, `electron-builder` (`apps/desktop/electron-builder.yml`), React 19 renderer, Vitest.

**R2 update base URL (resolved):** `https://pub-d230cd20641545cf88369006a73de152.r2.dev` — updates published at the bucket root. Unsigned NSIS builds confirmed acceptable for the internal test.

---

## Task 1: Update-state contract

**Files:**
- Create: `packages/contracts/src/app-update.ts`
- Create: `packages/contracts/src/app-update.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1.1:** Read `packages/contracts/src/daemon-health.ts` and `packages/contracts/src/connection-diagnostic.ts` to match the schema + `parse*` + index-export pattern.

- [ ] **Step 1.2:** Write a failing test `packages/contracts/src/app-update.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseAppUpdateState } from "./app-update";

describe("appUpdateState", () => {
  it("parses an available state with a version", () => {
    const s = parseAppUpdateState({ status: "available", version: "0.2.0" });
    expect(s).toEqual({ status: "available", version: "0.2.0" });
  });

  it("parses a downloading state with a percent", () => {
    expect(parseAppUpdateState({ status: "downloading", percent: 42 })).toEqual({
      status: "downloading",
      percent: 42
    });
  });

  it("parses an error state with a message", () => {
    expect(parseAppUpdateState({ status: "error", message: "offline" })).toEqual({
      status: "error",
      message: "offline"
    });
  });

  it("rejects an unknown status", () => {
    expect(() => parseAppUpdateState({ status: "bogus" })).toThrow();
  });
});
```

- [ ] **Step 1.3:** Run `npm run test --workspace @writer/contracts -- app-update` and confirm it FAILS (module not found).

- [ ] **Step 1.4:** Implement `packages/contracts/src/app-update.ts`:

```ts
import { z } from "zod";

export const appUpdateStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("idle") }),
  z.object({ status: z.literal("checking") }),
  z.object({ status: z.literal("available"), version: z.string().min(1) }),
  z.object({ status: z.literal("not-available") }),
  z.object({ status: z.literal("downloading"), percent: z.number().min(0).max(100) }),
  z.object({ status: z.literal("downloaded"), version: z.string().min(1) }),
  z.object({ status: z.literal("error"), message: z.string().min(1) })
]);

export type AppUpdateState = z.infer<typeof appUpdateStateSchema>;

export function parseAppUpdateState(payload: unknown): AppUpdateState {
  return appUpdateStateSchema.parse(payload);
}
```

- [ ] **Step 1.5:** Export from `packages/contracts/src/index.ts` (follow the existing alphabetical-ish grouping):

```ts
export { appUpdateStateSchema, parseAppUpdateState } from "./app-update";
export type { AppUpdateState } from "./app-update";
```

- [ ] **Step 1.6:** Run `npm run test --workspace @writer/contracts -- app-update` (PASS) and `npm run typecheck --workspace @writer/contracts` (PASS).

- [ ] **Step 1.7:** Commit: `feat(contracts): add app update state schema (WRI-223)`

---

## Task 2: Packaging and publish config

**Files:**
- Modify: `apps/desktop/electron-builder.yml`
- Modify: `apps/desktop/package.json` (dependencies)

- [ ] **Step 2.1:** Add `electron-updater` to `apps/desktop`: `npm install electron-updater --workspace @writer/desktop`. Confirm it lands in `apps/desktop/package.json` `dependencies` (not dev).

- [ ] **Step 2.2:** In `apps/desktop/electron-builder.yml`, add a top-level `publish` block so builds emit `latest.yml` + `.blockmap` and bake `app-update.yml`:

```yaml
publish:
  - provider: generic
    url: https://pub-d230cd20641545cf88369006a73de152.r2.dev
```

- [ ] **Step 2.3:** In the same file, extend the existing `nsis:` block with the belt-and-suspenders data guard (keep the existing keys):

```yaml
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Writer
  deleteAppDataOnUninstall: false
```

- [ ] **Step 2.4:** Document the manual R2 upload runbook by creating `openspec/changes/add-windows-auto-update-r2/release-runbook.md` with: build (`npm run build --workspace @writer/desktop`), then upload from `apps/desktop/dist-electron/` to the R2 bucket root (`https://pub-d230cd20641545cf88369006a73de152.r2.dev`) in this order — (1) `Writer-Setup-<version>.exe`, (2) `Writer-Setup-<version>.exe.blockmap`, (3) `latest.yml` LAST.

- [ ] **Step 2.5:** Run `npm run typecheck` (no TS impact, sanity) and commit: `build(desktop): NSIS generic R2 publish + preserve app data (WRI-223)`

---

## Task 3: Main-process updater module + IPC

**Files:**
- Create: `apps/desktop/electron/auto-update-state.cjs` (pure mapper, testable)
- Create: `apps/desktop/electron/auto-update-state.test.ts`
- Create: `apps/desktop/electron/auto-update.cjs` (Electron wiring)
- Modify: `apps/desktop/electron/main.cjs`

- [ ] **Step 3.1:** Write a failing test `apps/desktop/electron/auto-update-state.test.ts` for the pure mapper:

```ts
import { describe, expect, it } from "vitest";
const { mapUpdaterEvent } = require("./auto-update-state.cjs");

describe("mapUpdaterEvent", () => {
  it("maps checking-for-update", () => {
    expect(mapUpdaterEvent("checking-for-update")).toEqual({ status: "checking" });
  });
  it("maps update-available to available with version", () => {
    expect(mapUpdaterEvent("update-available", { version: "0.2.0" })).toEqual({
      status: "available",
      version: "0.2.0"
    });
  });
  it("maps update-not-available", () => {
    expect(mapUpdaterEvent("update-not-available")).toEqual({ status: "not-available" });
  });
  it("maps download-progress to a clamped percent", () => {
    expect(mapUpdaterEvent("download-progress", { percent: 41.7 })).toEqual({
      status: "downloading",
      percent: 41
    });
  });
  it("maps update-downloaded to downloaded with version", () => {
    expect(mapUpdaterEvent("update-downloaded", { version: "0.2.0" })).toEqual({
      status: "downloaded",
      version: "0.2.0"
    });
  });
  it("maps error to error with a message", () => {
    expect(mapUpdaterEvent("error", new Error("offline"))).toEqual({
      status: "error",
      message: "offline"
    });
  });
});
```

- [ ] **Step 3.2:** Run `npm run test --workspace @writer/desktop -- auto-update-state` and confirm it FAILS (module not found).

- [ ] **Step 3.3:** Implement the pure mapper `apps/desktop/electron/auto-update-state.cjs` (no Electron imports, so vitest can load it):

```js
// Pure mapping from electron-updater events to AppUpdateState (see
// packages/contracts/src/app-update.ts). No Electron / no I/O.
function mapUpdaterEvent(event, payload) {
  switch (event) {
    case "checking-for-update":
      return { status: "checking" };
    case "update-available":
      return { status: "available", version: payload.version };
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

- [ ] **Step 3.4:** Run `npm run test --workspace @writer/desktop -- auto-update-state` (PASS).

- [ ] **Step 3.5:** Implement the Electron wiring `apps/desktop/electron/auto-update.cjs`. It only forwards state and triggers updater actions — it MUST NOT read or write under the app dir, `resourcesPath`, or `~/.writer` (invariant):

```js
const { app, ipcMain } = require("electron");
const { mapUpdaterEvent } = require("./auto-update-state.cjs");

const UPDATE_EVENTS = [
  "checking-for-update",
  "update-available",
  "update-not-available",
  "download-progress",
  "update-downloaded",
  "error"
];

/** Wire auto-update for a packaged build. No-op in development. */
function initAutoUpdate(getWindow) {
  if (!app.isPackaged) {
    return;
  }

  const { autoUpdater } = require("electron-updater");
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  const send = (state) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("writer-update:state", state);
    }
  };

  for (const event of UPDATE_EVENTS) {
    autoUpdater.on(event, (payload) => send(mapUpdaterEvent(event, payload)));
  }

  ipcMain.handle("writer-update:check", () => autoUpdater.checkForUpdates());
  ipcMain.handle("writer-update:download", () => autoUpdater.downloadUpdate());
  ipcMain.handle("writer-update:restart", () => autoUpdater.quitAndInstall());

  // One auto-check on launch.
  autoUpdater.checkForUpdates().catch((error) => {
    send({ status: "error", message: error?.message || String(error) });
  });
}

module.exports = { initAutoUpdate };
```

- [ ] **Step 3.6:** Wire it into `apps/desktop/electron/main.cjs`: require the module at the top with the other requires, and call it right after `createWindow()` inside `app.whenReady().then(...)` (around line 202):

```js
const { initAutoUpdate } = require("./auto-update.cjs");
// ...
createWindow();
initAutoUpdate(() => mainWindow);
```

- [ ] **Step 3.7:** Run `npm run test --workspace @writer/desktop -- auto-update-state` (still PASS) and `npm run typecheck --workspace @writer/desktop` (PASS). Commit: `feat(desktop): main-process auto-updater wiring (WRI-223)`

---

## Task 4: Preload bridge + window typing

**Files:**
- Modify: `apps/desktop/electron/preload.cjs`
- Modify: `apps/desktop/src/writer-desktop.d.ts`

- [ ] **Step 4.1:** In `apps/desktop/electron/preload.cjs`, add a second isolated bridge `writerUpdate` (do not expose raw `ipcRenderer`):

```js
contextBridge.exposeInMainWorld("writerUpdate", {
  check: () => ipcRenderer.invoke("writer-update:check"),
  download: () => ipcRenderer.invoke("writer-update:download"),
  restartToInstall: () => ipcRenderer.invoke("writer-update:restart"),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("writer-update:state", listener);
    return () => ipcRenderer.removeListener("writer-update:state", listener);
  }
});
```

- [ ] **Step 4.2:** Read `apps/desktop/src/writer-desktop.d.ts` to match its global `Window` augmentation style, then add the `writerUpdate` typing using the shared contract type:

```ts
import type { AppUpdateState } from "@writer/contracts";

declare global {
  interface Window {
    writerUpdate?: {
      check: () => Promise<unknown>;
      download: () => Promise<unknown>;
      restartToInstall: () => Promise<unknown>;
      onState: (callback: (state: AppUpdateState) => void) => () => void;
    };
  }
}

export {};
```

- [ ] **Step 4.3:** Run `npm run typecheck --workspace @writer/desktop` (PASS). Commit: `feat(desktop): preload writerUpdate bridge + typings (WRI-223)`

---

## Task 5: Renderer Update affordance

**Files:**
- Create: `apps/desktop/src/components/writer/update-section.tsx`
- Create: `apps/desktop/src/components/writer/update-section.test.tsx`
- Modify: `apps/desktop/src/components/writer/writer-settings-tabs.tsx` (or `apps/desktop/src/screens/settings-screen.tsx` — whichever renders settings rows)

- [ ] **Step 5.1:** Read `apps/desktop/src/components/writer/writer-settings-tabs.tsx` and `apps/desktop/src/screens/settings-screen.tsx` to match the existing section/component pattern and CSS classes (`apps/desktop/src/styles/writer-settings-page.css`).

- [ ] **Step 5.2:** Write a failing test `apps/desktop/src/components/writer/update-section.test.tsx` driving a pure label helper (keep DOM-free for the repo's vitest setup):

```ts
import { describe, expect, it } from "vitest";
import { updateLabel } from "./update-section";

describe("updateLabel", () => {
  it("labels checking", () => {
    expect(updateLabel({ status: "checking" })).toBe("Checking for updates…");
  });
  it("labels available with version", () => {
    expect(updateLabel({ status: "available", version: "0.2.0" })).toBe("Update available: 0.2.0");
  });
  it("labels downloading with percent", () => {
    expect(updateLabel({ status: "downloading", percent: 42 })).toBe("Downloading… 42%");
  });
  it("labels downloaded", () => {
    expect(updateLabel({ status: "downloaded", version: "0.2.0" })).toBe("Update ready — restart to install");
  });
  it("labels error", () => {
    expect(updateLabel({ status: "error", message: "offline" })).toBe("Update error: offline");
  });
  it("labels up to date", () => {
    expect(updateLabel({ status: "not-available" })).toBe("You're up to date");
  });
});
```

- [ ] **Step 5.3:** Run `npm run test --workspace @writer/desktop -- update-section` and confirm it FAILS.

- [ ] **Step 5.4:** Implement `apps/desktop/src/components/writer/update-section.tsx` — export the pure `updateLabel` plus a component that subscribes via `window.writerUpdate` and renders Download/Restart buttons by state. Render nothing when `window.writerUpdate` is undefined (dev / non-packaged):

```tsx
import { useEffect, useState } from "react";
import type { AppUpdateState } from "@writer/contracts";

export function updateLabel(state: AppUpdateState): string {
  switch (state.status) {
    case "idle": return "Up to date";
    case "checking": return "Checking for updates…";
    case "available": return `Update available: ${state.version}`;
    case "not-available": return "You're up to date";
    case "downloading": return `Downloading… ${state.percent}%`;
    case "downloaded": return "Update ready — restart to install";
    case "error": return `Update error: ${state.message}`;
  }
}

export function UpdateSection() {
  const api = typeof window !== "undefined" ? window.writerUpdate : undefined;
  const [state, setState] = useState<AppUpdateState>({ status: "idle" });

  useEffect(() => {
    if (!api) return;
    return api.onState(setState);
  }, [api]);

  if (!api) return null;

  return (
    <section className="writer-settings-section">
      <header>App updates</header>
      <p>{updateLabel(state)}</p>
      <div className="writer-settings-actions">
        <button onClick={() => api.check()} disabled={state.status === "checking"}>
          Check for updates
        </button>
        {state.status === "available" && (
          <button onClick={() => api.download()}>Download</button>
        )}
        {state.status === "downloaded" && (
          <button onClick={() => api.restartToInstall()}>Restart to install</button>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 5.5:** Run `npm run test --workspace @writer/desktop -- update-section` (PASS).

- [ ] **Step 5.6:** Render `<UpdateSection />` in the settings surface (in `writer-settings-tabs.tsx` under the appropriate tab, matching sibling sections). Import: `import { UpdateSection } from "./update-section";`

- [ ] **Step 5.7:** Run `npm run typecheck --workspace @writer/desktop` (PASS). Commit: `feat(desktop): settings update affordance (WRI-223)`

---

## Task 6: Verification

**Files:**
- Create: `apps/desktop/electron/auto-update.guard.test.ts`
- Create: `openspec/changes/add-windows-auto-update-r2/verify.md` (evidence)

- [ ] **Step 6.1:** Write a guard test `apps/desktop/electron/auto-update.guard.test.ts` asserting the updater wiring never touches data paths (defends the invariant):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("auto-update invariant", () => {
  it("never references install-dir or user-data write paths", () => {
    const src = readFileSync(join(__dirname, "auto-update.cjs"), "utf8");
    expect(src).not.toMatch(/getAppPath/);
    expect(src).not.toMatch(/resourcesPath/);
    expect(src).not.toMatch(/\.writer/);
    expect(src).not.toMatch(/writeFile|rmSync|unlink|mkdir/);
  });
});
```

- [ ] **Step 6.2:** Run `npm run test --workspace @writer/desktop -- auto-update.guard` (PASS).

- [ ] **Step 6.3:** Run the full gates: `npm run typecheck`, then `npm run test`, then `npx openspec validate add-windows-auto-update-r2 --type change --strict`. All must pass.

- [ ] **Step 6.4:** Manual A→B end-to-end (record results in `verify.md`):
  1. Set version `0.1.0` in `apps/desktop/package.json`; `npm run build --workspace @writer/desktop`; install the produced `Writer-Setup-0.1.0.exe`.
  2. Launch; create a record, trigger a log write under `~/.writer/logs`, and confirm a `.gguf` exists in `~/.writer/models` (download the local model if needed).
  3. Bump version to `0.2.0`; rebuild; upload to the R2 bucket root in order: `.exe`, `.exe.blockmap`, then `latest.yml` LAST.
  4. Relaunch the installed `0.1.0`; confirm it reports `available: 0.2.0`, Download shows progress, Restart installs, and the app relaunches reporting `0.2.0`.
  5. Assert `~/.writer/platform-store.json`, `~/.writer/logs`, and the `.gguf` are present and unchanged, and the model was NOT re-downloaded.

- [ ] **Step 6.5:** Commit: `test(desktop): auto-update guard + verify evidence (WRI-223)`

Commit point: all OpenSpec tasks have evidence and the Windows auto-update PoC is ready for review.
