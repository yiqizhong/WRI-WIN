// Pure mapping from electron-updater events to AppUpdateState (see
// packages/contracts/src/app-update.ts). No Electron / no I/O.
function mapUpdaterEvent(event, payload) {
  switch (event) {
    case "checking-for-update":
      return { status: "checking" };
    case "update-available":
      return { status: "available", version: payload.version };
    case "update-not-available":
      return { status: "not-available" };
    case "download-progress":
      return { status: "downloading", percent: Math.floor(payload.percent) };
    case "update-downloaded":
      return { status: "downloaded", version: payload.version };
    case "error":
      return { status: "error", message: payload?.message || String(payload) };
    default:
      return { status: "idle" };
  }
}

module.exports = { mapUpdaterEvent };
