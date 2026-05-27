export type ScrollReason = "phase-active" | "send" | "message" | "stream";

/** Keep in sync with --writer-duration-bottom-push in writer-chat-welcome.css */
export const CHAT_BOTTOM_PUSH_MS = 320;

export function isNearBottom(container: HTMLElement, thresholdPx = 80): boolean {
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance <= thresholdPx;
}

export function scrollBehaviorForReason(reason: ScrollReason): ScrollBehavior {
  return reason === "send" || reason === "phase-active" ? "smooth" : "auto";
}

/** Pick scroll behavior when following the thread tail (send / stream / layout). */
export function scrollReasonForThreadFollow(input: {
  pendingAssistant: boolean;
  stickToBottom: boolean;
  streamingText: boolean;
}): ScrollReason {
  if (input.pendingAssistant && input.streamingText) {
    return "stream";
  }
  if (input.stickToBottom) {
    return "send";
  }
  return "message";
}

/** Scroll the chat thread container to the latest message (not the window). */
export function scrollContainerToEnd(
  container: HTMLElement,
  behavior: ScrollBehavior = "auto"
): void {
  container.scrollTo({ top: container.scrollHeight, behavior });
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
