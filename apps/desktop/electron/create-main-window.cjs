const path = require("node:path");

const { BrowserWindow } = require("electron");

const { applyWindowEffects } = require("./windows-window-effects.cjs");

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

  /**
   * Windows/Linux: transparent frameless window. On Windows the real desktop
   * acrylic blur + rounded corners are applied natively after creation in
   * applyWindowEffects() (SetWindowCompositionAttribute), since Electron's
   * backgroundMaterial does not composite the DWM blur into a transparent window.
   * The translucent CSS gradient tint then sits over the blurred desktop.
   */
  return {
    ...base,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false
  };
}

/** @returns {import("electron").BrowserWindow} */
function createMainWindow() {
  const window = new BrowserWindow(getMainWindowOptions());

  // Windows 11: native acrylic desktop blur + rounded corners (no-op elsewhere).
  applyWindowEffects(window);

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
