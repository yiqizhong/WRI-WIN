const { contextBridge, ipcRenderer } = require("electron");
const os = require("node:os");
const fsp = require("node:fs");
const { join: joinPath } = require("node:path");

// Wrapped in try-catch: a failure here must never prevent the rest of the
// preload from running — losing writerDesktop would break ALL window buttons.
let appVersion = "";
try {
  appVersion = require("../package.json").version || "";
} catch (_) {
  // Fallback: read from the Electron app version set by the main process.
  // writerDesktop.appVersion will be "" — welcome-screen version label is hidden.
}

// Per-launch daemon bearer token, written by the daemon at startup. Read here
// so the renderer can authenticate against the loopback daemon. Missing file
// (daemon not yet started) leaves it "" — requests will 401 until present.
let daemonToken = "";
try {
  daemonToken = fsp.readFileSync(joinPath(os.homedir(), ".writer", "daemon-token"), "utf8").trim();
} catch (_) {
  // No token file yet; renderer falls back to unauthenticated (will 401).
}

const usesNativeWindowBackdrop = process.platform === "darwin" || process.platform === "win32";

contextBridge.exposeInMainWorld("writerDesktop", {
  appVersion,
  daemonToken,
  platform: process.platform,
  windowChrome: usesNativeWindowBackdrop ? "transparent" : "opaque",
  windowMinimize: () => ipcRenderer.send("window:minimize"),
  windowMaximize: () => ipcRenderer.send("window:maximize"),
  windowClose: () => ipcRenderer.send("window:close"),
  windowIsMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  openExternal: (url) => ipcRenderer.invoke("writer:open-external", url),
  pickProjectFolder: () => ipcRenderer.invoke("writer:pick-project-folder"),
  pickSpreadsheetFile: () => ipcRenderer.invoke("writer:pick-spreadsheet-file"),
  pickPasteTextAttachment: (kind) => ipcRenderer.invoke("writer:pick-paste-text-attachment", kind),
  pickSaveFile: (options) => ipcRenderer.invoke("writer:pick-save-file", options),
  saveTextFile: (filePath, content) => ipcRenderer.invoke("writer:save-text-file", filePath, content),
  exportPdfFromHtml: (filePath, html) => ipcRenderer.invoke("writer:export-pdf-from-html", filePath, html),
  pickGuidelineFile: () => ipcRenderer.invoke("writer:pick-guideline-file"),
  pickGlossaryFile: () => ipcRenderer.invoke("writer:pick-glossary-file"),
  // DEV: live-switch the Win11 backdrop material to tune the look.
  setBackgroundMaterial: (material) =>
    ipcRenderer.invoke("writer:set-background-material", material)
});

const isPackaged = process.argv.includes("--is-packaged=true");

if (isPackaged) {
  contextBridge.exposeInMainWorld("writerUpdate", {
    check: () => ipcRenderer.invoke("writer-update:check"),
    download: () => ipcRenderer.invoke("writer-update:download"),
    restartToInstall: () => ipcRenderer.invoke("writer-update:restart"),
    getState: () => ipcRenderer.invoke("writer-update:get-state"),
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("writer-update:state", listener);
      return () => ipcRenderer.removeListener("writer-update:state", listener);
    }
  });
}
