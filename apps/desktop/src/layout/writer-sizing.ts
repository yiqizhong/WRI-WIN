/**
 * Figma-aligned sizing: Fill (stretch in parent) vs Hug (fit content).
 * Use these class names on layout shells; use Carbon defaults for controls.
 */

/** Width/height fill — stretch to the parent track or flex area. */
export const fillWidth = "writer-fill-w";
export const fillHeight = "writer-fill-h";
export const fill = "writer-fill-w writer-fill-h";

/** Width/height hug — shrink to content (tags, buttons, headings, bubbles). */
export const hugWidth = "writer-hug-w";
export const hugHeight = "writer-hug-h";

/** Grid column wrapper — always fill column width; optional fill row height. */
export function gridCell(fillRowHeight = false): string {
  return fillRowHeight ? "writer-grid-cell writer-grid-cell--fill-h" : "writer-grid-cell";
}

/** Tile / panel surface in a grid cell. */
export const surface = "writer-surface";
export const surfaceFillHeight = "writer-surface writer-surface--fill-h";
export const surfaceBody = "writer-surface__body";

/** Vertical stack that consumes remaining height in a fill shell. */
export const stackFill = "writer-stack-fill";

/** Toolbar / header rows — full width, hug height. */
export const row = "writer-row";
export const rowBetween = "writer-row writer-row--between";
export const rowEnd = "writer-row writer-row--end";

/** Chat message column — hug width, capped. */
export const chatBubble = "writer-chat-bubble";
export const chatBubbleEnd = "writer-chat-bubble writer-chat-bubble--end";

export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
