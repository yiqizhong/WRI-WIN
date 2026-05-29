/** Apply window chrome before first paint (avoids white flash + short viewport). */
export function bootstrapDocumentChrome(): void {
  const html = document.documentElement;
  html.classList.add("dark");

  const chrome = window.writerDesktop?.windowChrome === "transparent" ? "transparent" : "opaque";
  html.dataset.windowChrome = chrome;
  html.style.colorScheme = "dark";
  const platform = window.writerDesktop?.platform;
  html.dataset.platform =
    platform ??
    (navigator.platform.toLowerCase().includes("mac")
      ? "darwin"
      : navigator.userAgent.includes("Windows")
        ? "win32"
        : "other");

}
