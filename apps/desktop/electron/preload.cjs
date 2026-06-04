const { contextBridge, ipcRenderer } = require("electron");
const { version: appVersion } = require("../package.json");

const usesNativeWindowBackdrop = process.platform === "darwin" || process.platform === "win32";

contextBridge.exposeInMainWorld("writerDesktop", {
  appVersion,
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
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("writer-update:state", listener);
      return () => ipcRenderer.removeListener("writer-update:state", listener);
    }
  });
}
