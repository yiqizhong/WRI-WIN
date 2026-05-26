import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  composerFlipDelta,
  composerMotionForPhases,
  composerWelcomeToFooterDelta,
  WELCOME_HEADING_COMPOSER_GAP_PX,
  WELCOME_INPUT_MOVE_MS,
  WELCOME_MESSAGE_RISE_MS,
  welcomeComposerTopBelowHeadingPx,
  welcomeComposerTopPx,
  welcomeHeroLayout
} from "./composer-motion";

describe("composerMotionForPhases", () => {
  it("animates the first send toward the active dock", () => {
    expect(composerMotionForPhases("welcome", "active", false)).toEqual({
      direction: "to-active",
      animate: true
    });
  });

  it("animates new chat back toward welcome", () => {
    expect(composerMotionForPhases("active", "welcome", false)).toEqual({
      direction: "to-welcome",
      animate: true
    });
  });

  it("suppresses interpolation for reduced motion", () => {
    expect(composerMotionForPhases("welcome", "active", true).animate).toBe(false);
  });
});

describe("composerFlipDelta", () => {
  it("returns the translation from layout target to visual start", () => {
    expect(
      composerFlipDelta(
        { left: 120, top: 240 },
        { left: 120, top: 660 }
      )
    ).toEqual({ x: 0, y: -420 });
  });
});

describe("welcome send motion duration", () => {
  it("uses 350ms for desktop input drop (Gemini ref 250ms)", () => {
    expect(WELCOME_INPUT_MOVE_MS).toBe(350);
  });

  it("lands the user message quickly, then delays the thinking indicator slightly", () => {
    expect(WELCOME_MESSAGE_RISE_MS).toBe(680);
  });
});

describe("welcome heading ↔ composer spacing", () => {
  it("uses a fixed 24px gap", () => {
    expect(WELCOME_HEADING_COMPOSER_GAP_PX).toBe(24);
  });

  it("positions composer top at heading bottom plus gap", () => {
    const heading = {
      getBoundingClientRect: () =>
        ({ bottom: 220, top: 180, left: 0, right: 0, width: 0, height: 40, x: 0, y: 180 }) as DOMRect
    } as HTMLElement;
    const shell = {
      getBoundingClientRect: () =>
        ({ top: 100, bottom: 900, left: 0, right: 0, width: 0, height: 800, x: 0, y: 100 }) as DOMRect
    } as HTMLElement;
    expect(welcomeComposerTopBelowHeadingPx(heading, shell)).toBe(144);
  });

  it("centers heading + composer as one block in the scroll region", () => {
    const heading = {
      getBoundingClientRect: () =>
        ({ bottom: 240, top: 200, left: 0, right: 0, width: 0, height: 40, x: 0, y: 200 }) as DOMRect
    } as HTMLElement;
    const composerHost = {
      getBoundingClientRect: () =>
        ({ bottom: 320, top: 264, left: 0, right: 0, width: 0, height: 56, x: 0, y: 264 }) as DOMRect
    } as HTMLElement;
    const scrollRegion = {
      getBoundingClientRect: () =>
        ({ top: 120, bottom: 820, left: 0, right: 0, width: 0, height: 700, x: 0, y: 120 }) as DOMRect
    } as HTMLElement;

    expect(welcomeHeroLayout(heading, composerHost, scrollRegion)).toEqual({
      headingPadTopPx: 290
    });
  });

  it("pins overlay composer to the in-flow spacer below the heading", () => {
    const spacer = {
      getBoundingClientRect: () =>
        ({ top: 264, bottom: 320, left: 0, right: 0, width: 0, height: 56, x: 0, y: 264 }) as DOMRect
    } as HTMLElement;
    const shell = {
      getBoundingClientRect: () =>
        ({ top: 100, bottom: 900, left: 0, right: 0, width: 0, height: 800, x: 0, y: 100 }) as DOMRect
    } as HTMLElement;

    expect(welcomeComposerTopPx(spacer, shell)).toBe(164);
  });
});

describe("composerWelcomeToFooterDelta", () => {
  it("offsets from hero composer rect to footer inner top", () => {
    const hero = {
      left: 100,
      top: 300,
      right: 700,
      bottom: 380,
      width: 600,
      height: 80,
      x: 100,
      y: 300,
      toJSON: () => ({})
    } as DOMRect;
    const footer = {
      left: 100,
      top: 720,
      right: 700,
      bottom: 800,
      width: 600,
      height: 80,
      x: 100,
      y: 720,
      toJSON: () => ({})
    } as DOMRect;
    expect(composerWelcomeToFooterDelta(hero, footer)).toEqual({ x: 0, y: -420 });
  });
});

describe("ChatShellView composer render site", () => {
  it("renders the supplied composer exactly once in ChatShellView", () => {
    const source = readFileSync(
      new URL("./chat-shell-view.tsx", import.meta.url),
      "utf8"
    );
    expect(source.match(/\{composer\}/g)).toHaveLength(1);
    expect(source).toContain("writer-chat-welcome-hero");
    expect(source).toContain("welcomeHeadingRef");
    expect(source).toContain("welcomeHeroLayout");
    expect(source).toContain("welcomeComposerSpacerRef");
    expect(source).toContain("welcomeComposerTopPx");
    expect(source).toMatch(/welcomeSendTransition \|\| composerAnimating/);
    expect(source).toContain('phase === "active"');
    expect(source).toContain('setComposerPlacement("footer")');
    expect(source).toContain('host.style.removeProperty("top")');
    expect(source).toContain("writer-chat-composer-host");
    expect(source).toContain("animateComposerWelcomeToFooter");
    expect(source).toContain("flushSync");
    expect(source).toContain("getBoundingClientRect()");
  });

  it("does not render pending assistant status during the welcome send transition", () => {
    const source = readFileSync(
      new URL("../text-copy-chat.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toContain("if (isAssistant && isPending && welcomeSendTransition)");
  });
});

describe("writer-chat-welcome.css motion contracts", () => {
  const chatCss = readFileSync(
    new URL("../styles/writer-chat-welcome.css", import.meta.url),
    "utf8"
  );

  it("defines reduced-motion fallbacks for composer transitions", () => {
    expect(chatCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(chatCss).toContain(".writer-chat-composer-motion-dock");
    expect(chatCss).toContain(".writer-chat-welcome-composer-textarea-inner");
    expect(chatCss).toContain(".writer-chat-welcome-hero");
    expect(chatCss).toContain("justify-content: center");
    expect(chatCss).toContain("--writer-duration-input-move: 350ms");
    expect(chatCss).toContain("--writer-welcome-heading-composer-gap: 24px");
    expect(chatCss).toContain("--writer-duration-message-rise: 520ms");
    expect(chatCss).toMatch(/writer-chat-first-message-rise[\s\S]*\)\s+40ms both/);
    expect(chatCss).toContain(".writer-chat-composer-host");
    expect(chatCss).toContain('data-placement="footer"]');
    expect(chatCss).toMatch(/\[data-placement="footer"\][\s\S]*margin-top:\s*auto/);
    expect(chatCss).toContain("--writer-composer-height-expand-duration: 0.25s");
    expect(chatCss).toContain(".writer-chat-welcome-composer-field.animate-height-collapse");
    expect(chatCss).toContain("--writer-composer-height-collapse-easing: linear(");
  });
});
