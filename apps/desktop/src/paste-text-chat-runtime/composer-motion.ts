import type { ChatPhase } from "./chat-phase";

/** Gemini reference: input-move-to-bottom 250ms; desktop WAAPI path uses 350ms */
export const WELCOME_INPUT_MOVE_MS = 350;
/** Fixed gap between welcome heading line and composer on the welcome screen */
export const WELCOME_HEADING_COMPOSER_GAP_PX = 24;
/** Gemini reference: move-up (first user message) */
export const WELCOME_MESSAGE_RISE_MS = 500;
/** Gemini reference: zero-state fade-out */
export const WELCOME_ZERO_LEAVE_MS = 150;

type Position = Pick<DOMRect, "left" | "top">;

export function welcomeComposerTopPx(
  headingEl: HTMLElement,
  shellEl: HTMLElement,
  gapPx = WELCOME_HEADING_COMPOSER_GAP_PX
) {
  const headingRect = headingEl.getBoundingClientRect();
  const shellRect = shellEl.getBoundingClientRect();
  return headingRect.bottom - shellRect.top + gapPx;
}

export function composerFlipDelta(visualStart: Position, layoutTarget: Position) {
  return { x: visualStart.left - layoutTarget.left, y: visualStart.top - layoutTarget.top };
}

/** FLIP delta from hero composer position to the footer dock slot. */
export function composerWelcomeToFooterDelta(
  heroComposerRect: DOMRect,
  footerDockTargetRect: DOMRect
) {
  return composerFlipDelta(
    { left: heroComposerRect.left, top: heroComposerRect.top },
    { left: footerDockTargetRect.left, top: footerDockTargetRect.top }
  );
}

export function composerMotionForPhases(
  previous: ChatPhase,
  next: ChatPhase,
  reducedMotion: boolean
) {
  const direction =
    previous === "welcome" && next === "active"
      ? "to-active"
      : previous === "active" && next === "welcome"
        ? "to-welcome"
        : null;

  return {
    direction,
    animate: direction !== null && !reducedMotion
  } as const;
}
