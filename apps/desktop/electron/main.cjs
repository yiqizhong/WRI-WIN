const { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } = require("electron");
const { writeFile } = require("node:fs/promises");
const path = require("node:path");

const { createMainWindow } = require("./create-main-window.cjs");
const { ensureDaemonRunning, stopManagedDaemon } = require("./ensure-daemon.cjs");

const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173";

/** @type {import("electron").BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  const window = createMainWindow();
  mainWindow = window;

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (app.isPackaged) {
    window.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  } else {
    window.loadURL(devServerUrl);
  }

  return window;
}

ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on("window:close", () => mainWindow?.close());
ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);

ipcMain.handle("writer:set-background-material", (_event, material) => {
  if (process.platform !== "win32" || !mainWindow) {
    return false;
  }
  // material: "none" | "mica" | "acrylic" | "tabbed"
  mainWindow.setBackgroundMaterial(material);
  mainWindow.setBackgroundColor("#00000000");
  return true;
});

ipcMain.handle("writer:open-external", async (_event, url) => {
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("writer:pick-project-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("writer:pick-spreadsheet-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Spreadsheets", extensions: ["csv", "xlsx", "xls"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("writer:pick-guideline-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Guideline (Markdown)", extensions: ["md"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const fs = require("node:fs/promises");
  const path = require("node:path");
  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, "utf8");
  return { filename: path.basename(filePath), content };
});

ipcMain.handle("writer:pick-glossary-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Glossary (CSV or Markdown)", extensions: ["csv", "md"] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const fs = require("node:fs/promises");
  const path = require("node:path");
  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, "utf8");
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return { filename: path.basename(filePath), content, format: ext === "csv" ? "csv" : "md" };
});

ipcMain.handle("writer:pick-paste-text-attachment", async (_event, kind) => {
  const filters =
    kind === "spreadsheet"
      ? [{ name: "Spreadsheet", extensions: ["csv", "xlsx", "xls"] }]
      : kind === "plain_text"
        ? [{ name: "Text file", extensions: ["txt", "md"] }]
        : [{ name: "Paste text attachments", extensions: ["csv", "xlsx", "xls", "txt", "md"] }];

  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("writer:pick-save-file", async (_event, options = {}) => {
  const result = await dialog.showSaveDialog({
    defaultPath: options.defaultPath,
    filters: options.filters ?? [{ name: "All files", extensions: ["*"] }]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  return result.filePath;
});

ipcMain.handle("writer:save-text-file", async (_event, filePath, content) => {
  await writeFile(filePath, content, "utf8");
  return filePath;
});

ipcMain.handle("writer:export-pdf-from-html", async (_event, filePath, html) => {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await window.webContents.printToPDF({ printBackground: true });
    await writeFile(filePath, pdf);
    return filePath;
  } finally {
    window.destroy();
  }
});

app.whenReady().then(async () => {
  nativeTheme.themeSource = "dark";

  try {
    await ensureDaemonRunning();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const os = require("node:os");
    const logDir =
      process.env.WRITER_DAEMON_LOG_DIR || path.join(os.homedir(), ".writer", "logs");
    const { response } = await dialog.showMessageBox({
      type: "error",
      title: "Writer",
      message: "Writer's background service didn't start",
      detail:
        `${message}\n\n` +
        `Reopen Writer to try again. If it keeps happening, send these log files to support:\n` +
        `${path.join(logDir, "daemon.log")}\n` +
        `${path.join(logDir, "daemon-spawn.log")}`,
      buttons: ["Open logs folder", "OK"],
      defaultId: 1,
      cancelId: 1
    });
    if (response === 0) {
      await shell.openPath(logDir);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (mainWindow === null || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      mainWindow.focus();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void stopManagedDaemon();
});

