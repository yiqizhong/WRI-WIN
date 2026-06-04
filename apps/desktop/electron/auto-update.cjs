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

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // re-check every 60 minutes
const MIN_FOCUS_RECHECK_MS = 5 * 60 * 1000; // don't re-check on focus more than once per 5 min

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
  let lastCheckTime = 0;

  const send = (state) => {
    cachedState = state;
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("writer-update:state", state);
    }
  };

  const safeCheck = () => {
    const now = Date.now();
    if (now - lastCheckTime < MIN_FOCUS_RECHECK_MS) return;
    lastCheckTime = now;
    checkWithRetry(autoUpdater).catch((error) => {
      send({ status: "error", message: error?.message || String(error) });
    });
  };

  ipcMain.handle("writer-update:get-state", () => cachedState);

  for (const event of ["checking-for-update", "update-available", "update-not-available", "download-progress", "update-downloaded", "error"]) {
    autoUpdater.on(event, (payload) => send(mapUpdaterEvent(event, payload)));
  }

  ipcMain.handle("writer-update:check", () => checkWithRetry(autoUpdater));
  ipcMain.handle("writer-update:download", () => autoUpdater.downloadUpdate());
  ipcMain.handle("writer-update:restart", () => {
    // Hide the window before quitting so Windows never marks it "Not Responding"
    // while the NSIS installer launches (CreateProcess blocks the main thread briefly).
    const window = getWindow();
    if (window && !window.isDestroyed()) window.hide();
    autoUpdater.quitAndInstall();
  });

  // Check on launch.
  safeCheck();

  // Re-check every 60 minutes while the app is running.
  setInterval(safeCheck, CHECK_INTERVAL_MS);

  // Re-check when the window regains focus (user returns to the app).
  app.on("browser-window-focus", () => safeCheck());
}

module.exports = { initAutoUpdate };
