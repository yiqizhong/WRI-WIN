/** Gemini `.ui-improvements-phase-1 .text-input-field_textarea-inner` — multiline expand */
export const COMPOSER_HEIGHT_EXPAND_MS = 250;

/** Gemini `.lm-input-redesign.animate-height-collapse` — elastic shrink */
export const COMPOSER_HEIGHT_COLLAPSE_MS = 500;

/**
 * Spring-like `linear()` stops from Gemini welcome input (height collapse only).
 * @see https://gemini.google.com/app — `.lm-input-redesign.animate-height-collapse`
 */
export const COMPOSER_HEIGHT_COLLAPSE_LINEAR =
  "linear(0, .002, .01 3.6%, .034, .074 7.9%, .132 10.2%, .209 12.8%, .307 15.6%, .4 17.3%, .501 19.3%, .586 21.2%, .658 23.1%, .72 25.2%, .773 27.4%, .818 29.8%, .856 32.6%, .888 35.8%, .913 39.5%, .933 43.9%, .949 49.2%, .962 55.7%, .972 63.5%, .981 73.6%, .989 85.7%, 1)";

export const COMPOSER_HEIGHT_FIELD_COLLAPSE_CLASS = "animate-height-collapse";

export function isComposerHeightCollapsing(
  previousHeightPx: number,
  nextHeightPx: number
): boolean {
  return nextHeightPx < previousHeightPx - 0.5;
}

export function composerHeightTransitionProperty(isCollapsing: boolean): string {
  return isCollapsing
    ? `height ${COMPOSER_HEIGHT_COLLAPSE_MS}ms ${COMPOSER_HEIGHT_COLLAPSE_LINEAR}`
    : `height ${COMPOSER_HEIGHT_EXPAND_MS}ms`;
}
