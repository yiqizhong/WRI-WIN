/**
 * Native Windows 11 window effects for the frameless transparent window:
 *   1. Real desktop acrylic blur behind the window (SetWindowCompositionAttribute
 *      with ACCENT_ENABLE_ACRYLICBLURBEHIND) — Electron's backgroundMaterial does
 *      not reliably composite the DWM blur into a transparent Chromium window, so
 *      we drive the undocumented user32 API directly.
 *   2. Rounded corners (DwmSetWindowAttribute DWMWA_WINDOW_CORNER_PREFERENCE) so the
 *      blur backing matches the CSS rounded frame.
 *
 * The translucent CSS gradient tint (.writer-window-frame__glass) then sits on top
 * of the blurred desktop, giving "opaque gradient + blur together".
 *
 * @platform win32 (Windows 10 1803+ / Windows 11; silently no-ops elsewhere)
 */

let koffi = null;
let DwmSetWindowAttribute = null;
let SetWindowCompositionAttribute = null;
let AccentPolicy = null;
let WinCompAttrData = null;

const DWMWA_WINDOW_CORNER_PREFERENCE = 33;
const DWMWCP_ROUND = 2;

const DWMWA_BORDER_COLOR = 34;
// DWMWA_BORDER_COLOR takes a COLORREF (0x00BBGGRR). Dark blue #21366B.
const BORDER_COLOR_DARK_BLUE = 0x006b3621;

const WCA_ACCENT_POLICY = 19;
const ACCENT_ENABLE_ACRYLICBLURBEHIND = 4;
// AccentFlags bits 1..4 draw the left/top/right/bottom borders of the accent.
const DRAW_ALL_BORDERS = 0x20 | 0x40 | 0x80 | 0x100;

function load() {
  if (SetWindowCompositionAttribute) {
    return true;
  }
  try {
    koffi = require("koffi");

    const dwmapi = koffi.load("dwmapi.dll");
    DwmSetWindowAttribute = dwmapi.func(
      "__stdcall",
      "DwmSetWindowAttribute",
      "int",
      ["uintptr_t", "uint32", "void *", "uint32"]
    );

    // struct ACCENT_POLICY { int AccentState; int AccentFlags; int GradientColor; int AnimationId; }
    AccentPolicy = koffi.struct("ACCENT_POLICY", {
      AccentState: "int",
      AccentFlags: "int",
      GradientColor: "uint32",
      AnimationId: "int"
    });

    // struct WINDOWCOMPOSITIONATTRIBDATA { int Attrib; void* pvData; size_t cbData; }
    WinCompAttrData = koffi.struct("WINDOWCOMPOSITIONATTRIBDATA", {
      Attrib: "int",
      pvData: "void *",
      cbData: "size_t"
    });

    const user32 = koffi.load("user32.dll");
    SetWindowCompositionAttribute = user32.func(
      "__stdcall",
      "SetWindowCompositionAttribute",
      "int",
      ["uintptr_t", koffi.pointer(WinCompAttrData)]
    );

    return true;
  } catch (error) {
    console.warn(
      "[writer-desktop] window-effects: koffi/native API unavailable:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/** @param {import("electron").BrowserWindow} window */
function hwndOf(window) {
  const buf = window.getNativeWindowHandle();
  return buf.length >= 8
    ? buf.readBigUInt64LE(0)
    : BigInt(buf.readUInt32LE(0));
}

function applyRoundedCorners(hwnd) {
  const pref = Buffer.alloc(4);
  pref.writeInt32LE(DWMWCP_ROUND, 0);
  const hr = DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, pref, 4);
  if (hr !== 0) {
    console.warn("[writer-desktop] DwmSetWindowAttribute corner HRESULT", hr);
  }
}

/** Color the native DWM window border dark blue (Windows 11 22000+). */
function applyBorderColor(hwnd) {
  const color = Buffer.alloc(4);
  color.writeUInt32LE(BORDER_COLOR_DARK_BLUE, 0);
  const hr = DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, color, 4);
  if (hr !== 0) {
    console.warn("[writer-desktop] DwmSetWindowAttribute border HRESULT", hr);
  }
}

/**
 * Enable the acrylic blur-behind.
 * GradientColor is 0xAABBGGRR. A low alpha keeps the blur readable; the CSS
 * gradient tint provides the actual color, so we use a near-transparent dark base.
 */
function applyAcrylicBlur(hwnd) {
  // 0x01000000 = alpha 0x01 (almost no native tint), so the CSS gradient owns the color.
  const accent = {
    AccentState: ACCENT_ENABLE_ACRYLICBLURBEHIND,
    AccentFlags: DRAW_ALL_BORDERS,
    GradientColor: 0x01000000,
    AnimationId: 0
  };
  const accentBuf = koffi.alloc(AccentPolicy, 1);
  koffi.encode(accentBuf, AccentPolicy, accent);

  const data = {
    Attrib: WCA_ACCENT_POLICY,
    pvData: accentBuf,
    cbData: koffi.sizeof(AccentPolicy)
  };

  const ok = SetWindowCompositionAttribute(hwnd, data);
  if (!ok) {
    console.warn("[writer-desktop] SetWindowCompositionAttribute returned 0 (failed)");
  }
}

/** @param {import("electron").BrowserWindow} window */
function applyWindowEffects(window) {
  if (process.platform !== "win32") {
    return;
  }
  if (!load()) {
    return;
  }
  try {
    const hwnd = hwndOf(window);
    applyRoundedCorners(hwnd);
    applyBorderColor(hwnd);
  } catch (error) {
    console.warn(
      "[writer-desktop] window-effects: apply failed:",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Re-apply only the dark-blue DWM border. Call this AFTER setBackgroundMaterial,
 * which resets the border color back to the system default gray.
 * @param {import("electron").BrowserWindow} window
 */
function applyBorderColorEffect(window) {
  if (process.platform !== "win32") {
    return;
  }
  if (!load()) {
    return;
  }
  try {
    applyBorderColor(hwndOf(window));
  } catch (error) {
    console.warn(
      "[writer-desktop] window-effects: border apply failed:",
      error instanceof Error ? error.message : error
    );
  }
}

module.exports = { applyWindowEffects, applyBorderColorEffect };
