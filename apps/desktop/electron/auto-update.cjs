const { app, ipcMain } = require("electron");
const path = require("path");
const zlib = require("zlib");
const https = require("https");
const fs = require("fs");
const { mapUpdaterEvent } = require("./auto-update-state.cjs");

/**
 * Compute the real differential (patch) download size WITHOUT starting the
 * actual download.
 *
 * Reads the cached blockmap for the currently installed version, downloads
 * the new version's blockmap from R2, runs computeOperations(), and sums
 * the DOWNLOAD operations to get the exact bytes that will be fetched.
 * Returns null if anything fails (falls back to showing no size).
 */
async function computePatchSize(autoUpdater, updateInfo) {
  try {
    const { OperationKind, computeOperations } = require(
      "electron-updater/out/differentialDownloader/downloadPlanBuilder"
    );
    const { getAppCacheDir } = require("electron-updater/out/AppAdapter");

    // Resolve cache dir (mirrors electron-updater's own logic).
    const config = await autoUpdater.configOnDisk.value;
    const cacheDir = path.join(getAppCacheDir(), config.updaterCacheDirName || app.name);

    // Read the old blockmap (gzip JSON) stored by the previous update.
    const oldBlockMapFile = path.join(cacheDir, "current.blockmap");
    if (!fs.existsSync(oldBlockMapFile)) return null;
    const oldBlockMap = JSON.parse(zlib.gunzipSync(fs.readFileSync(oldBlockMapFile)).toString());

    // Construct the new blockmap URL: <baseUrl>/<installerFilename>.blockmap
    const baseUrl = (config.url || "").replace(/\/$/, "");
    const installerFile = updateInfo.files?.[0]?.url;
    if (!baseUrl || !installerFile) return null;
    const newBlockMapUrl = `${baseUrl}/${installerFile.replace(/ /g, "%20")}.blockmap`;

    // Download the new blockmap.
    const newBlockMapBuf = await new Promise((resolve, reject) => {
      https.get(newBlockMapUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${newBlockMapUrl}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    });
    const newBlockMap = JSON.parse(zlib.gunzipSync(newBlockMapBuf).toString());

    // Run the same operation planner electron-updater uses internally.
    const noop = () => {};
    const ops = computeOperations(oldBlockMap, newBlockMap, { debug: noop, info: noop, warn: noop, error: noop });

    let downloadBytes = 0;
    for (const op of ops) {
      if (op.kind === OperationKind.DOWNLOAD) downloadBytes += op.end - op.start;
    }
    return downloadBytes > 0 ? downloadBytes : null;
  } catch (e) {
    console.warn("[writer-update] patch size calculation failed:", e.message);
    return null;
  }
}

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

  for (const event of ["checking-for-update", "update-not-available", "download-progress", "update-downloaded", "error"]) {
    autoUpdater.on(event, (payload) => send(mapUpdaterEvent(event, payload)));
  }

  autoUpdater.on("update-available", (payload) => {
    const state = mapUpdaterEvent("update-available", payload);
    send(state);

    // Probe the real patch size in the background — no download started.
    // Re-emits available with downloadBytes once the blockmap diff is done.
    computePatchSize(autoUpdater, payload).then((downloadBytes) => {
      if (downloadBytes != null) {
        send({ ...state, downloadBytes });
      }
    });
  });

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
