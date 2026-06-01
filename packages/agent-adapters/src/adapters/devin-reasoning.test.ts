import { describe, expect, it } from "vitest";

import {
  buildModelSpecifier,
  getDevinReasoningProfile,
  normalizeDevinReasoningPreference
} from "./devin-reasoning";

describe("Devin reasoning profiles", () => {
  it("exposes four distinct SWE levels backed by tau-* specifiers", () => {
    const profile = getDevinReasoningProfile("swe-1.6");
    expect(profile.options).toEqual(["off", "low", "medium", "high"]);
    expect(profile.capabilityStatus).toBe("applied");

    expect(buildModelSpecifier("swe-1.6", "off")).toBe("swe-1.6");
    expect(buildModelSpecifier("swe-1.6", "low")).toBe("tau-low");
    expect(buildModelSpecifier("swe-1.6", "medium")).toBe("tau-medium");
    expect(buildModelSpecifier("swe-1.6", "high")).toBe("tau-max");
  });

  it("exposes four distinct Claude Opus 4.7 levels", () => {
    const profile = getDevinReasoningProfile("claude-opus-4.7");
    expect(profile.options).toEqual(["off", "low", "medium", "high"]);
    expect(profile.capabilityStatus).toBe("applied");

    expect(buildModelSpecifier("claude-opus-4.7", "off")).toBe("claude-opus-4.7");
    expect(buildModelSpecifier("claude-opus-4.7", "low")).toBe("claude-opus-4-7-medium");
    expect(buildModelSpecifier("claude-opus-4.7", "medium")).toBe("claude-opus-4-7-high");
    expect(buildModelSpecifier("claude-opus-4.7", "high")).toBe("claude-opus-4-7-max-thinking");
  });

  it("only exposes off/high for Claude Sonnet models with a single thinking tier", () => {
    const profile = getDevinReasoningProfile("claude-sonnet-4.6");
    expect(profile.options).toEqual(["off", "high"]);
    expect(profile.capabilityStatus).toBe("mapped");

    expect(buildModelSpecifier("claude-sonnet-4.6", "off")).toBe("claude-sonnet-4.6");
    expect(buildModelSpecifier("claude-sonnet-4.6", "high")).toBe("claude-sonnet-4-6-thinking");
    expect(buildModelSpecifier("claude-sonnet-4.6", "low")).toBe("claude-sonnet-4-6-thinking");
    expect(buildModelSpecifier("claude-sonnet-4.6", "medium")).toBe("claude-sonnet-4-6-thinking");
  });

  it("does not expose reasoning controls for GPT/Gemini models", () => {
    const profile = getDevinReasoningProfile("gpt-5.4");
    expect(profile.options).toEqual([]);
    expect(profile.capabilityStatus).toBe("unsupported");
    expect(buildModelSpecifier("gpt-5.4", "high")).toBe("gpt-5.4");
  });

  it("normalizes invalid preferences to the highest supported thinking tier", () => {
    expect(normalizeDevinReasoningPreference("claude-sonnet-4.6", "medium")).toBe("high");
    expect(normalizeDevinReasoningPreference("claude-sonnet-4.6", "off")).toBe("off");
    expect(normalizeDevinReasoningPreference("swe-1.6", "high")).toBe("high");
  });
});
