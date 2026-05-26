import { describe, expect, it } from "vitest";

import {
  composerHeightForContent,
  composerScrollTopAfterGrow,
  lineHeightFromComputedStyle
} from "./writer-chat-composer-sizing";

describe("composerHeightForContent", () => {
  it("keeps one visible line as the minimum", () => {
    expect(composerHeightForContent({ scrollHeight: 10, lineHeight: 23 })).toEqual({
      height: 23,
      overflowY: "hidden"
    });
  });

  it("allows content through five visible lines", () => {
    expect(composerHeightForContent({ scrollHeight: 92, lineHeight: 23 })).toEqual({
      height: 92,
      overflowY: "hidden"
    });
  });

  it("caps longer drafts and enables internal scroll", () => {
    expect(composerHeightForContent({ scrollHeight: 161, lineHeight: 23 })).toEqual({
      height: 115,
      overflowY: "auto"
    });
  });

  it("shrinks back to one line when content is deleted", () => {
    const lineHeight = 23;
    const fiveLines = lineHeight * 5;
    const threeLines = lineHeight * 3;

    expect(
      composerHeightForContent({ scrollHeight: fiveLines, lineHeight }).height
    ).toBe(fiveLines);
    expect(
      composerHeightForContent({ scrollHeight: threeLines, lineHeight }).height
    ).toBe(threeLines);
    expect(composerHeightForContent({ scrollHeight: 12, lineHeight }).height).toBe(lineHeight);
  });
});

describe("composerScrollTopAfterGrow", () => {
  it("pins scroll to top when growing and all content fits", () => {
    expect(
      composerScrollTopAfterGrow({
        previousScrollTop: 12,
        previousHeightPx: 46,
        nextHeightPx: 69,
        scrollHeight: 69
      })
    ).toBe(0);
  });

  it("keeps scroll position when growing but content still overflows", () => {
    expect(
      composerScrollTopAfterGrow({
        previousScrollTop: 40,
        previousHeightPx: 92,
        nextHeightPx: 115,
        scrollHeight: 200
      })
    ).toBe(40);
  });
});

describe("lineHeightFromComputedStyle", () => {
  it("converts unitless line-height ratios using font size", () => {
    expect(lineHeightFromComputedStyle("1.35", "17px")).toBeCloseTo(22.95, 2);
  });

  it("uses pixel line heights directly", () => {
    expect(lineHeightFromComputedStyle("23px", "17px")).toBe(23);
  });

  it("falls back when line-height is normal", () => {
    expect(lineHeightFromComputedStyle("normal", "16px")).toBeCloseTo(21.6, 2);
  });
});

