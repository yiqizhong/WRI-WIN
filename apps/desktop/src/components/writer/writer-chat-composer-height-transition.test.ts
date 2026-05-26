import { describe, expect, it } from "vitest";

import {
  COMPOSER_HEIGHT_COLLAPSE_LINEAR,
  composerHeightTransitionProperty,
  isComposerHeightCollapsing
} from "./writer-chat-composer-height-transition";

describe("composer height transitions (Gemini parity)", () => {
  it("uses 0.25s for expand", () => {
    expect(composerHeightTransitionProperty(false)).toBe("height 250ms");
  });

  it("uses 0.5s linear() spring for collapse", () => {
    expect(composerHeightTransitionProperty(true)).toBe(
      `height 500ms ${COMPOSER_HEIGHT_COLLAPSE_LINEAR}`
    );
  });

  it("detects collapse when height shrinks", () => {
    expect(isComposerHeightCollapsing(120, 92)).toBe(true);
    expect(isComposerHeightCollapsing(92, 120)).toBe(false);
    expect(isComposerHeightCollapsing(92, 91.6)).toBe(false);
  });
});
