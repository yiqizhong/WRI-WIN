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
