const path = require("node:path");

const { BrowserWindow } = require("electron");

/** @returns {import("electron").BrowserWindowConstructorOptions} */
function getMainWindowOptions() {
  const webPreferences = {
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false
  };

  /** Figma frame 1060:829 — fixed 1280×860, no resize */
  const base = {
    width: 1280,
    height: 860,
    minWidth: 1280,
    maxWidth: 1280,
    minHeight: 860,
    maxHeight: 860,
    resizable: false,
    title: "Writer",
    show: false,
    webPreferences
  };

  if (process.platform === "darwin") {
    return {
      ...base,
      frame: false,
      titleBarStyle: "hidden",
      transparent: true,
      backgroundColor: "#00000000",
      /**
       * Native macOS NSVisualEffectView provides the actual desktop blur.
       * CSS backdrop-filter cannot blur the OS desktop in transparent Electron windows
       * because Chromium does not have access to the desktop pixels.
       * 'under-window' + 'active' state = always-on frosted glass that blurs the wallpaper.
       */
      vibrancy: "under-window",
      visualEffectState: "active",
      hasShadow: false,
      acceptFirstMouse: true
    };
  }

  return {
    ...base,
    backgroundColor: "#010311"
  };
}

/** @returns {import("electron").BrowserWindow} */
function createMainWindow() {
  const window = new BrowserWindow(getMainWindowOptions());

  window.once("ready-to-show", () => {
    if (process.platform === "darwin") {
      window.setBackgroundColor("#00000000");
      window.setWindowButtonVisibility(false);
    }
    window.show();
  });

  return window;
}

module.exports = { createMainWindow, getMainWindowOptions };
