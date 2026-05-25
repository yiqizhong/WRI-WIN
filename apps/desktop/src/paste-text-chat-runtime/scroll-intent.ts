export type ScrollReason = "phase-active" | "send" | "message" | "stream";

export function isNearBottom(container: HTMLElement, thresholdPx = 80): boolean {
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance <= thresholdPx;
}

export function scrollBehaviorForReason(reason: ScrollReason): ScrollBehavior {
  return reason === "send" || reason === "phase-active" ? "smooth" : "auto";
}

export function createScrollThrottle(intervalMs: number) {
  let lastFiredAt = 0;

  return {
    shouldScroll(): boolean {
      const now = Date.now();
      if (now - lastFiredAt >= intervalMs) {
        lastFiredAt = now;
        return true;
      }
      return false;
    },
    reset() {
      lastFiredAt = 0;
    }
  };
}
