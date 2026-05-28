/** Scroll edge fade masks (Figma Audit / Audits Log). */
export function syncScrollEdgeMask(scrollEl: HTMLDivElement | null) {
  if (!scrollEl) {
    return;
  }

  const canScroll = scrollEl.scrollHeight > scrollEl.clientHeight + 1;
  const atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2;

  scrollEl.dataset.canScroll = canScroll ? "true" : "false";
  scrollEl.dataset.atBottom = atBottom ? "true" : "false";
}
