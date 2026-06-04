// Pure mapping from electron-updater events to AppUpdateState (see
// packages/contracts/src/app-update.ts). No Electron / no I/O.

/**
 * electron-updater's UpdateInfo.releaseNotes can be:
 *   - string
 *   - Array<{ version: string, note: string | null }>
 *   - null / undefined
 * Always returns a trimmed non-empty string or undefined.
 */
function normalizeReleaseNotes(raw) {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw.trim() || undefined;
  if (Array.isArray(raw)) {
    return raw.map(function (e) { return e.note || ""; }).filter(Boolean).join("\n\n") || undefined;
  }
  return undefined;
}

function mapUpdaterEvent(event, payload) {
  switch (event) {
    case "checking-for-update":
      return { status: "checking" };
    case "update-available": {
      const notes = normalizeReleaseNotes(payload.releaseNotes);
      return { status: "available", version: payload.version, ...(notes ? { releaseNotes: notes } : {}) };
    }
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
