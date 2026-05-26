import { WELCOME_INPUT_MOVE_MS } from "./composer-motion";

const EMPHASIZED_EASING = "cubic-bezier(0.2, 0, 0, 1)";

export function prefersReducedWelcomeSendMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function measureFooterLayout(host: HTMLElement) {
  host.style.removeProperty("top");
  void host.offsetHeight;
  return host.getBoundingClientRect();
}

function runWelcomeToFooterAnimation(
  host: HTMLElement,
  from: DOMRect,
  to: DOMRect,
  durationMs: number
): Promise<void> {
  const dx = from.left - to.left;
  const dy = from.top - to.top;

  if (Math.hypot(dx, dy) < 1) {
    host.style.transform = "";
    return Promise.resolve();
  }

  host.style.transform = `translate(${dx}px, ${dy}px)`;

  const animation = host.animate(
    [
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: "translate(0, 0)" }
    ],
    { duration: durationMs, easing: EMPHASIZED_EASING, fill: "forwards" }
  );

  return animation.finished.finally(() => {
    host.style.transform = "";
  });
}

/**
 * Animate the composer host from a welcome-screen box to the footer layout.
 * Caller must snapshot `fromRect` while still welcome-centered, then commit
 * `data-placement="footer"` (e.g. via flushSync) before invoking this.
 */
export function animateComposerWelcomeToFooter(
  host: HTMLElement,
  durationMs: number = WELCOME_INPUT_MOVE_MS,
  fromRect?: DOMRect
): Promise<void> {
  const from = fromRect ?? host.getBoundingClientRect();

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const to = measureFooterLayout(host);
      void runWelcomeToFooterAnimation(host, from, to, durationMs).then(resolve);
    });
  });
}
