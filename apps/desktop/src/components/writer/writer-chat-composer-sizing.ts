const MIN_VISIBLE_LINES = 1;
const MAX_VISIBLE_LINES = 5;
const FALLBACK_LINE_HEIGHT_PX = 23;

/** @deprecated Use `COMPOSER_HEIGHT_EXPAND_MS` — kept for existing imports */
export { COMPOSER_HEIGHT_EXPAND_MS as COMPOSER_HEIGHT_TRANSITION_MS } from "./writer-chat-composer-height-transition";

/** Resolve px line height from getComputedStyle (handles `normal` and unitless ratios). */
export function lineHeightFromComputedStyle(lineHeight: string, fontSize: string): number {
  const parsedLineHeight = Number.parseFloat(lineHeight);
  const parsedFontSize = Number.parseFloat(fontSize);

  if (Number.isFinite(parsedLineHeight) && parsedLineHeight > 0) {
    if (parsedLineHeight < 10 && Number.isFinite(parsedFontSize) && parsedFontSize > 0) {
      return parsedFontSize * parsedLineHeight;
    }
    return parsedLineHeight;
  }

  if (Number.isFinite(parsedFontSize) && parsedFontSize > 0) {
    return parsedFontSize * 1.35;
  }

  return FALLBACK_LINE_HEIGHT_PX;
}

export function composerScrollTopAfterGrow(input: {
  previousScrollTop: number;
  previousHeightPx: number;
  nextHeightPx: number;
  scrollHeight: number;
}): number {
  const growing = input.nextHeightPx > input.previousHeightPx + 0.5;
  if (!growing) {
    return input.previousScrollTop;
  }

  if (input.scrollHeight <= input.nextHeightPx + 1) {
    return 0;
  }

  return input.previousScrollTop;
}

/** Keep the first line fixed when the field grows taller (avoids upward “pull” while animating). */
export function preserveComposerScrollAnchor(
  textarea: HTMLTextAreaElement,
  previousScrollTop: number,
  previousHeightPx: number,
  nextHeightPx: number
) {
  textarea.scrollTop = composerScrollTopAfterGrow({
    previousScrollTop,
    previousHeightPx,
    nextHeightPx,
    scrollHeight: textarea.scrollHeight
  });
}

export function composerHeightForContent(input: {
  scrollHeight: number;
  lineHeight: number;
}) {
  const minHeight = input.lineHeight * MIN_VISIBLE_LINES;
  const maxHeight = input.lineHeight * MAX_VISIBLE_LINES;
  const height = Math.max(minHeight, Math.min(input.scrollHeight, maxHeight));

  return {
    height,
    overflowY: input.scrollHeight > maxHeight ? ("auto" as const) : ("hidden" as const)
  };
}

/** Measure content height without mutating the visible textarea (preserves CSS/WAAPI transitions). */
export function measureTextareaContentHeight(textarea: HTMLTextAreaElement): number {
  if (typeof document === "undefined") {
    return fallbackMeasureTextareaContentHeight(textarea);
  }

  const computed = window.getComputedStyle(textarea);
  const clone = document.createElement("textarea");
  clone.value = textarea.value;
  clone.rows = 1;
  clone.setAttribute("aria-hidden", "true");
  clone.tabIndex = -1;
  clone.readOnly = true;
  clone.style.position = "fixed";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  clone.style.height = "auto";
  clone.style.minHeight = "0";
  clone.style.maxHeight = "none";
  clone.style.overflow = "hidden";
  clone.style.width = `${textarea.offsetWidth}px`;
  clone.style.font = computed.font;
  clone.style.lineHeight = computed.lineHeight;
  clone.style.padding = computed.padding;
  clone.style.border = computed.border;
  clone.style.boxSizing = computed.boxSizing;
  clone.style.letterSpacing = computed.letterSpacing;
  clone.style.setProperty("field-sizing", "fixed");

  document.body.appendChild(clone);
  const scrollHeight = clone.scrollHeight;
  document.body.removeChild(clone);

  return scrollHeight;
}

function fallbackMeasureTextareaContentHeight(textarea: HTMLTextAreaElement): number {
  const previousHeight = textarea.style.height;
  const previousMinHeight = textarea.style.minHeight;
  const previousMaxHeight = textarea.style.maxHeight;
  const previousOverflowY = textarea.style.overflowY;

  textarea.style.height = "auto";
  textarea.style.minHeight = "0";
  textarea.style.maxHeight = "none";
  textarea.style.overflowY = "hidden";
  const scrollHeight = textarea.scrollHeight;

  textarea.style.height = previousHeight;
  textarea.style.minHeight = previousMinHeight;
  textarea.style.maxHeight = previousMaxHeight;
  textarea.style.overflowY = previousOverflowY;

  return scrollHeight;
}
