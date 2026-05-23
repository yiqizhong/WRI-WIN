const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("writerDesktop", {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke("writer:open-external", url),
  pickProjectFolder: () => ipcRenderer.invoke("writer:pick-project-folder"),
  pickSpreadsheetFile: () => ipcRenderer.invoke("writer:pick-spreadsheet-file"),
  pickSaveFile: (options) => ipcRenderer.invoke("writer:pick-save-file", options),
  saveTextFile: (filePath, content) => ipcRenderer.invoke("writer:save-text-file", filePath, content),
  exportPdfFromHtml: (filePath, html) => ipcRenderer.invoke("writer:export-pdf-from-html", filePath, html)
});

