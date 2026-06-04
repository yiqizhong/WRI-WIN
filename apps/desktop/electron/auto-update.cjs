const { app, ipcMain } = require("electron");
const path = require("path");
const zlib = require("zlib");
const https = require("https");
const fs = require("fs");
const { mapUpdaterEvent } = require("./auto-update-state.cjs");

/** Download a gzipped blockmap from a URL and return the parsed JSON, or null. */
async function fetchBlockMap(url) {
  try {
    const buf = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    });
    return JSON.parse(zlib.gunzipSync(buf).toString());
  } catch (e) {
    console.warn("[writer-update] fetchBlockMap failed:", e.message);
    return null;
  }
}

/**
 * Compute the real differential (patch) download size WITHOUT starting the
 * actual download — using only the blockmap files, no electron-updater
 * internal modules (those don't resolve reliably inside the packaged asar).
 *
 * A blockmap lists every block of the installer as parallel checksums[] and
 * sizes[] arrays. Any block in the NEW installer whose checksum already
 * exists in the OLD installer is copied locally (free); the rest must be
 * downloaded. Summing the sizes of download-only blocks gives the exact
 * patch size electron-updater will fetch.
 *
 * Old blockmap source order:
 *   1. current.blockmap in the updater cache (written after a prior update)
 *   2. <baseUrl>/Writer Setup <currentVersion>.exe.blockmap from R2 (fallback
 *      for fresh manual installs that never ran a differential update)
 *
 * Returns null on any failure (modal then shows no size, never a wrong one).
 */
async function computePatchSize(autoUpdater, updateInfo) {
  try {
    const config = await autoUpdater.configOnDisk.value;
    const baseUrl = (config.url || "").replace(/\/$/, "");
    const installerFile = updateInfo.files?.[0]?.url;
    if (!baseUrl || !installerFile) return null;

    const cacheDir = path.join(
      process.env.LOCALAPPDATA || path.join(app.getPath("home"), "AppData", "Local"),
      config.updaterCacheDirName || app.name
    );

    // --- Old blockmap ---
    let oldBlockMap = null;
    const cachedOld = path.join(cacheDir, "current.blockmap");
    if (fs.existsSync(cachedOld)) {
      try {
        oldBlockMap = JSON.parse(zlib.gunzipSync(fs.readFileSync(cachedOld)).toString());
      } catch (e) {
        console.warn("[writer-update] cached blockmap unreadable:", e.message);
      }
    }
    if (!oldBlockMap) {
      // Fallback: download the currently-installed version's blockmap from R2.
      const oldFile = `Writer Setup ${app.getVersion()}.exe.blockmap`;
      oldBlockMap = await fetchBlockMap(`${baseUrl}/${encodeURIComponent(oldFile)}`);
    }
    if (!oldBlockMap) return null;

    // --- New blockmap ---
    const newBlockMap = await fetchBlockMap(`${baseUrl}/${installerFile.replace(/ /g, "%20")}.blockmap`);
    if (!newBlockMap) return null;

    // --- Diff: sum sizes of blocks present in new but not in old ---
    const oldChecksums = new Set();
    for (const f of oldBlockMap.files || []) {
      for (const c of f.checksums || []) oldChecksums.add(c);
    }
    let downloadBytes = 0;
    for (const f of newBlockMap.files || []) {
      const checksums = f.checksums || [];
      const sizes = f.sizes || [];
      for (let i = 0; i < checksums.length; i++) {
        if (!oldChecksums.has(checksums[i])) downloadBytes += sizes[i] || 0;
      }
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

  // Hard gate: replace downloadUpdate on the instance so it is impossible
  // for any internal electron-updater logic (autoDownload race, re-check,
  // etc.) to start a download without the user clicking Upgrade.
  // The IPC handler below is the ONLY place that sets downloadConsented.
  let downloadConsented = false;
  const _originalDownloadUpdate = autoUpdater.downloadUpdate.bind(autoUpdater);
  autoUpdater.downloadUpdate = (...args) => {
    if (!downloadConsented) {
      console.warn("[writer-update] downloadUpdate() blocked — waiting for user consent");
      return Promise.resolve([]);
    }
    return _originalDownloadUpdate(...args);
  };

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
  ipcMain.handle("writer-update:download", () => {
    downloadConsented = true;
    return autoUpdater.downloadUpdate();
  });
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
