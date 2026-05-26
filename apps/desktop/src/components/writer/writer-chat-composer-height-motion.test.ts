import { describe, expect, it } from "vitest";

import {
  shouldAnimateComposerHeight
} from "./writer-chat-composer-height-motion";

describe("shouldAnimateComposerHeight", () => {
  it("animates when height changes materially", () => {
    expect(shouldAnimateComposerHeight(23, 46)).toBe(true);
    expect(shouldAnimateComposerHeight(115, 92)).toBe(true);
  });

  it("skips animation for sub-pixel noise", () => {
    expect(shouldAnimateComposerHeight(46, 46.2)).toBe(false);
  });
});
