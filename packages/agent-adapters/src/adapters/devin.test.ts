import { afterEach, describe, expect, it } from "vitest";

import {
  DEVIN_MODEL_TEMPORARILY_PINNED,
  getDevinCuratedModelOptions,
  getDevinModelDisplayLabel,
  getDevinReasoningProfile,
  getDevinRuntimeSettings,
  normalizeDevinModelId,
  resolveDevinModelId,
  setDevinRuntimeSettings
} from "./devin";

describe("Devin runtime settings", () => {
  const originalModel = process.env.DEVIN_MODEL;

  afterEach(() => {
    if (originalModel === undefined) {
      delete process.env.DEVIN_MODEL;
    } else {
      process.env.DEVIN_MODEL = originalModel;
    }
    setDevinRuntimeSettings({});
  });

  it("prefers persisted model over DEVIN_MODEL", () => {
    process.env.DEVIN_MODEL = "env-model";
    setDevinRuntimeSettings({ modelId: "gpt-5.4" });
    if (DEVIN_MODEL_TEMPORARILY_PINNED) {
      expect(resolveDevinModelId()).toBe("swe-1.6");
      return;
    }
    expect(resolveDevinModelId()).toBe("gpt-5.4");
  });

  it("falls back to DEVIN_MODEL, then default model", () => {
    setDevinRuntimeSettings({});
    process.env.DEVIN_MODEL = "env-model";
    if (DEVIN_MODEL_TEMPORARILY_PINNED) {
      expect(resolveDevinModelId()).toBe("swe-1.6");
      return;
    }
    expect(resolveDevinModelId()).toBe("env-model");

    delete process.env.DEVIN_MODEL;
    expect(resolveDevinModelId()).toBe("swe-1.6");
  });

  it("derives capability status from the selected model profile", () => {
    setDevinRuntimeSettings({ modelId: "swe-1.6", reasoningPreference: "high" });
    expect(getDevinRuntimeSettings().reasoningCapabilityStatus).toBe("applied");

    if (DEVIN_MODEL_TEMPORARILY_PINNED) {
      return;
    }

    setDevinRuntimeSettings({ modelId: "claude-sonnet-4.6", reasoningPreference: "high" });
    expect(getDevinRuntimeSettings().reasoningCapabilityStatus).toBe("mapped");

    setDevinRuntimeSettings({ modelId: "gpt-5.4", reasoningPreference: "medium" });
    expect(getDevinRuntimeSettings().reasoningCapabilityStatus).toBe("unsupported");
  });

  it("normalizes Claude Sonnet reasoning to supported tiers", () => {
    if (DEVIN_MODEL_TEMPORARILY_PINNED) {
      setDevinRuntimeSettings({ modelId: "claude-sonnet-4.6", reasoningPreference: "medium" });
      expect(getDevinRuntimeSettings().reasoningPreference).toBe("medium");
      return;
    }

    setDevinRuntimeSettings({ modelId: "claude-sonnet-4.6", reasoningPreference: "medium" });
    expect(getDevinRuntimeSettings().reasoningPreference).toBe("high");
  });

  it("exposes only the curated model list with display labels", () => {
    expect(getDevinCuratedModelOptions()).toEqual([
      "claude-sonnet-4.6",
      "claude-opus-4.7",
      "claude-opus-4.8",
      "claude-haiku-4.5",
      "gemini-3.1-pro",
      "gemini-3.5-flash",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.5",
      "swe-1.6"
    ]);
    expect(getDevinModelDisplayLabel("claude-sonnet-4.6")).toBe("Claude Sonnet 4.6");
    expect(getDevinModelDisplayLabel("gpt-5.4-mini")).toBe("ChatGPT 5.4 mini");
    expect(getDevinModelDisplayLabel("swe-1.6")).toBe("SWE 1.6 (free)");
  });

  it("falls back unknown persisted models to swe-1.6", () => {
    setDevinRuntimeSettings({ modelId: "swe-1.6-fast" });
    expect(resolveDevinModelId()).toBe("swe-1.6");
    expect(normalizeDevinModelId("swe-1.5")).toBe("swe-1.6");
    // gpt-5.4 is now a curated model — it normalizes to itself, not the fallback
    expect(normalizeDevinModelId("gpt-5.4")).toBe("gpt-5.4");
  });
});

describe("getDevinReasoningProfile exports", () => {
  it("documents that sonnet 4.6 does not have low/medium/high tiers", () => {
    expect(getDevinReasoningProfile("claude-sonnet-4.6").options).toEqual(["off", "high"]);
  });
});
