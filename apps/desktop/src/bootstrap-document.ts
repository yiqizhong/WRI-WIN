/** Apply window chrome before first paint (avoids white flash + short viewport). */
export function bootstrapDocumentChrome(): void {
  const html = document.documentElement;
  html.classList.add("dark");

  const chrome = window.writerDesktop?.windowChrome === "transparent" ? "transparent" : "opaque";
  html.dataset.windowChrome = chrome;
  html.style.colorScheme = "dark";
  html.dataset.platform =
    window.writerDesktop?.platform ??
    (navigator.platform.toLowerCase().includes("mac") ? "darwin" : "other");

}
