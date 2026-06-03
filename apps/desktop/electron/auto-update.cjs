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

  const send = (state) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("writer-update:state", state);
    }
  };

  for (const event of UPDATE_EVENTS) {
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

  // One auto-check on launch — retries on transient DNS failures (e.g. slow corporate DNS).
  checkWithRetry(autoUpdater).catch((error) => {
    send({ status: "error", message: error?.message || String(error) });
  });
}

module.exports = { initAutoUpdate };
