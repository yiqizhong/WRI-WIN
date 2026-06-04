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

const CHECK_MAX_RETRIES = 3;
const CHECK_RETRY_DELAY_MS = 10_000;

/** Returns true for transient network errors worth retrying (e.g. slow corporate DNS). */
function isRetryableError(error) {
  const msg = error?.message || String(error);
  return msg.includes("ERR_NAME_NOT_RESOLVED") || msg.includes("ERR_INTERNET_DISCONNECTED") || msg.includes("ENOTFOUND");
}

/** checkForUpdates with automatic retry on transient network errors. */
async function checkWithRetry(autoUpdater, retries = CHECK_MAX_RETRIES, delayMs = CHECK_RETRY_DELAY_MS) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await autoUpdater.checkForUpdates();
    } catch (error) {
      if (isRetryableError(error) && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
}

/** Wire auto-update for a packaged build. No-op in development. */
function initAutoUpdate(getWindow) {
  if (!app.isPackaged) {
    return;
  }

  const { autoUpdater } = require("electron-updater");
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // Cache the latest state so the renderer can pull it synchronously on mount,
  // avoiding the race where update-available fires before AppShell is ready.
  let cachedState = { status: "idle" };

  const send = (state) => {
    cachedState = state;
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("writer-update:state", state);
    }
  };

  ipcMain.handle("writer-update:get-state", () => cachedState);

  // Tracks silent background download state.
  // While true, download-progress events are suppressed from the renderer;
  // the first event's `total` is used to patch the available state with the
  // real differential download size.
  let silentMode = false;
  let lastAvailableState = null;

  autoUpdater.on("checking-for-update", () => send(mapUpdaterEvent("checking-for-update")));
  autoUpdater.on("update-not-available", () => send(mapUpdaterEvent("update-not-available")));
  autoUpdater.on("update-downloaded", (payload) => send(mapUpdaterEvent("update-downloaded", payload)));
  autoUpdater.on("error", (payload) => send(mapUpdaterEvent("error", payload)));

  autoUpdater.on("update-available", (payload) => {
    const state = mapUpdaterEvent("update-available", payload);
    lastAvailableState = state;
    send(state);

    // Start a silent background download immediately so we can capture the real
    // differential size from the first download-progress event.
    silentMode = true;
    autoUpdater.downloadUpdate().catch(() => {
      // Errors surface via the "error" event — swallow the rejected promise here.
    });
  });

  autoUpdater.on("download-progress", (payload) => {
    if (silentMode) {
      // Patch the available state with the real download size on the first tick.
      if (lastAvailableState && (payload.total ?? 0) > 0) {
        send({ ...lastAvailableState, downloadBytes: payload.total });
        lastAvailableState = null;
      }
      return; // suppress progress UI until user clicks Upgrade
    }
    send(mapUpdaterEvent("download-progress", payload));
  });

  ipcMain.handle("writer-update:check", () => checkWithRetry(autoUpdater));

  ipcMain.handle("writer-update:download", () => {
    // Switch from silent mode → visible mode so progress events reach the renderer.
    silentMode = false;
  });

  ipcMain.handle("writer-update:restart", () => {
    // Hide the window before quitting so Windows never marks it "Not Responding"
    // while the NSIS installer launches (CreateProcess blocks the main thread briefly).
    const window = getWindow();
    if (window && !window.isDestroyed()) window.hide();
    autoUpdater.quitAndInstall();
  });

  // One auto-check on launch — retries on transient DNS failures (e.g. slow corporate DNS).
  checkWithRetry(autoUpdater).catch((error) => {
    send({ status: "error", message: error?.message || String(error) });
  });
}

module.exports = { initAutoUpdate };
