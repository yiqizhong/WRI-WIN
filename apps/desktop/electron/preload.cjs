const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("writerDesktop", {
  platform: process.platform
});

