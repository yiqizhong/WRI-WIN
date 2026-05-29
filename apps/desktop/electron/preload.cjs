const { contextBridge, ipcRenderer } = require("electron");

const usesNativeWindowBackdrop = process.platform === "darwin" || process.platform === "win32";

contextBridge.exposeInMainWorld("writerDesktop", {
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
  pickGlossaryFile: () => ipcRenderer.invoke("writer:pick-glossary-file")
});

