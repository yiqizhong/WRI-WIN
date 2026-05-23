const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("writerDesktop", {
  platform: process.platform,
  pickProjectFolder: () => ipcRenderer.invoke("writer:pick-project-folder"),
  pickSpreadsheetFile: () => ipcRenderer.invoke("writer:pick-spreadsheet-file")
});

