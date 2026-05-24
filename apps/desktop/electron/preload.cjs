const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("writerDesktop", {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke("writer:open-external", url),
  pickProjectFolder: () => ipcRenderer.invoke("writer:pick-project-folder"),
  pickSpreadsheetFile: () => ipcRenderer.invoke("writer:pick-spreadsheet-file"),
  pickPasteTextAttachment: () => ipcRenderer.invoke("writer:pick-paste-text-attachment"),
  pickSaveFile: (options) => ipcRenderer.invoke("writer:pick-save-file", options),
  saveTextFile: (filePath, content) => ipcRenderer.invoke("writer:save-text-file", filePath, content),
  exportPdfFromHtml: (filePath, html) => ipcRenderer.invoke("writer:export-pdf-from-html", filePath, html),
  pickGuidelineFile: () => ipcRenderer.invoke("writer:pick-guideline-file"),
  pickGlossaryFile: () => ipcRenderer.invoke("writer:pick-glossary-file")
});

