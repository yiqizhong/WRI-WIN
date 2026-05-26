import { describe, expect, it, vi } from "vitest";

import {
  createScrollThrottle,
  isNearBottom,
  scrollBehaviorForReason,
  scrollContainerToEnd
} from "./scroll-intent";

describe("scrollBehaviorForReason", () => {
  it("uses smooth scroll on send", () => {
    expect(scrollBehaviorForReason("send")).toBe("smooth");
  });

  it("uses auto scroll on stream ticks", () => {
    expect(scrollBehaviorForReason("stream")).toBe("auto");
  });
});

describe("isNearBottom", () => {
  it("returns true when scrolled to bottom", () => {
    const element = {
      scrollHeight: 1000,
      scrollTop: 900,
      clientHeight: 100
    } as HTMLElement;

    expect(isNearBottom(element)).toBe(true);
  });

  it("returns false when far from bottom", () => {
    const element = {
      scrollHeight: 1000,
      scrollTop: 0,
      clientHeight: 100
    } as HTMLElement;

    expect(isNearBottom(element)).toBe(false);
  });
});

describe("scrollContainerToEnd", () => {
  it("sets scrollTop to scrollHeight on the container", () => {
    const scrollTo = vi.fn();
    const container = {
      scrollHeight: 2400,
      scrollTo
    } as unknown as HTMLElement;

    scrollContainerToEnd(container, "smooth");
    expect(scrollTo).toHaveBeenCalledWith({ top: 2400, behavior: "smooth" });
  });
});

describe("createScrollThrottle", () => {
  it("allows first call and blocks until interval elapses", () => {
    const throttle = createScrollThrottle(300);
    expect(throttle.shouldScroll()).toBe(true);
    expect(throttle.shouldScroll()).toBe(false);
  });
});
