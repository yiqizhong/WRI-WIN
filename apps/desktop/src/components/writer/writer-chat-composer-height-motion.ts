import { COMPOSER_HEIGHT_TRANSITION_MS } from "./writer-chat-composer-sizing";

export function prefersReducedComposerHeightMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function shouldAnimateComposerHeight(fromPx: number, toPx: number): boolean {
  return !prefersReducedComposerHeightMotion() && Math.abs(fromPx - toPx) > 0.5;
}

/** Imperative height tween — reliable when React inline styles skip CSS transitions. */
export function animateComposerHeight(
  element: HTMLElement,
  toPx: number,
  durationMs: number = COMPOSER_HEIGHT_TRANSITION_MS
): Animation | null {
  const fromPx = element.getBoundingClientRect().height;
  if (!shouldAnimateComposerHeight(fromPx, toPx)) {
    return null;
  }

  return element.animate(
    { height: [`${fromPx}px`, `${toPx}px`] },
    { duration: durationMs, easing: "linear", fill: "forwards" }
  );
}
