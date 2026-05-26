import type { ChatPhase } from "./chat-phase";

/** Gemini reference: input-move-to-bottom 250ms; desktop WAAPI path uses 350ms */
export const WELCOME_INPUT_MOVE_MS = 350;
/** Fixed gap between welcome heading line and composer on the welcome screen */
export const WELCOME_HEADING_COMPOSER_GAP_PX = 24;
/** First user message lands at 560ms; assistant status appears after a short hold. */
export const WELCOME_MESSAGE_RISE_MS = 680;
/** Show thinking ribbon this many ms before WELCOME_MESSAGE_RISE_MS during first send. */
export const WELCOME_THINKING_EARLIER_MS = 500;
export const WELCOME_THINKING_VISIBLE_MS = Math.max(
  0,
  WELCOME_MESSAGE_RISE_MS - WELCOME_THINKING_EARLIER_MS
);
/** Gemini reference: zero-state fade-out */
export const WELCOME_ZERO_LEAVE_MS = 150;
/** Active chat footer: lift the input card above the dock slot (CSS + welcome-send target). */
export const ACTIVE_FOOTER_COMPOSER_LIFT_PX = 8;

type Position = Pick<DOMRect, "left" | "top">;

export type WelcomeHeroLayout = {
  /** Padding-top on the welcome hero column inside the scroll region */
  headingPadTopPx: number;
};

/** Vertically center heading + gap + composer as one block in the scroll region. */
export function welcomeHeroLayout(
  headingEl: HTMLElement,
  composerHostEl: HTMLElement,
  scrollRegionEl: HTMLElement,
  gapPx = WELCOME_HEADING_COMPOSER_GAP_PX
): WelcomeHeroLayout {
  const scrollRect = scrollRegionEl.getBoundingClientRect();
  const headingHeight = headingEl.getBoundingClientRect().height;
  const composerHeight = composerHostEl.getBoundingClientRect().height;
  const totalHeight = headingHeight + gapPx + composerHeight;
  const headingPadTopPx = Math.max(0, (scrollRect.height - totalHeight) / 2);

  return { headingPadTopPx };
}

/** Pin the overlay composer to the in-flow spacer below the welcome heading. */
export function welcomeComposerTopPx(
  composerSpacerEl: HTMLElement,
  shellEl: HTMLElement
) {
  const spacerRect = composerSpacerEl.getBoundingClientRect();
  const shellRect = shellEl.getBoundingClientRect();
  return spacerRect.top - shellRect.top;
}

/** Legacy helper: composer top when heading and shell rects are already known */
export function welcomeComposerTopBelowHeadingPx(
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
