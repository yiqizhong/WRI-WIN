import { describe, expect, it } from "vitest";

import { buildCopywriterPrompt, parseCopywriterResponse } from "./copywriter-skill";

describe("copywriter-skill", () => {
  it("injects background and brand voice into prompt", () => {
    const prompt = buildCopywriterPrompt({
      backgroundContext: "Settings page, formal tone",
      brandVoice: "Clear and direct",
      userText: "Click here to save"
    });

    expect(prompt.full).toContain("Senior Software Copywriter");
    expect(prompt.full).toContain("Settings page, formal tone");
    expect(prompt.full).toContain("Clear and direct");
    expect(prompt.full).toContain("Click here to save");
    expect(prompt.full).toContain("Respond with only the rewritten text");
  });

  it("parses plain rewrite output", () => {
    const result = parseCopywriterResponse("Save changes");
    expect(result.suggestedText).toBe("Save changes");
  });

  it("parses labeled rewrite output", () => {
    const result = parseCopywriterResponse("Suggested rewrite: Save your changes");
    expect(result.suggestedText).toBe("Save your changes");
  });

  it("preserves off-topic refusal", () => {
    const result = parseCopywriterResponse("I can only rewrite UX copy. Paste the text you want improved.");
    expect(result.suggestedText).toContain("I can only rewrite UX copy");
  });

  it("emits three guideline layers in priority order with conflict resolution", () => {
    const prompt = buildCopywriterPrompt({
      companyBase: "Company rules",
      softwareWriting: "Software rules",
      productGuideline: "Product rules",
      userText: "Click here"
    });

    const companyIndex = prompt.full.indexOf("Writing rules (Company Base):");
    const softwareIndex = prompt.full.indexOf("Writing rules (Software Writing):");
    const productIndex = prompt.full.indexOf("Writing rules (Product):");
    expect(companyIndex).toBeGreaterThan(-1);
    expect(softwareIndex).toBeGreaterThan(companyIndex);
    expect(productIndex).toBeGreaterThan(softwareIndex);
    expect(prompt.full).toContain("prefer Product over Software Writing over Company Base");
  });

  it("omits missing software writing layer without placeholders", () => {
    const prompt = buildCopywriterPrompt({
      companyBase: "Company rules",
      productGuideline: "Product rules",
      userText: "Click here"
    });

    expect(prompt.full).toContain("Writing rules (Company Base):");
    expect(prompt.full).toContain("Writing rules (Product):");
    expect(prompt.full).not.toContain("Writing rules (Software Writing):");
    expect(prompt.full).toContain("prefer Product over Software Writing over Company Base");
  });

  it("keeps history and user text after guideline sections", () => {
    const prompt = buildCopywriterPrompt({
      companyBase: "Company rules",
      history: [{ role: "user", text: "Old copy" }],
      userText: "New copy"
    });

    const rulesIndex = prompt.full.indexOf("Writing rules (Company Base):");
    const historyIndex = prompt.full.indexOf("Conversation history:");
    const copyIndex = prompt.full.indexOf("Copy to rewrite:");
    expect(rulesIndex).toBeLessThan(historyIndex);
    expect(historyIndex).toBeLessThan(copyIndex);
  });

  it("emits feature context after writing rules and before history", () => {
    const prompt = buildCopywriterPrompt({
      companyBase: "Company rules",
      featureName: "Checkout",
      description: "Payment confirmation flow",
      history: [{ role: "user", text: "Old copy" }],
      userText: "New copy"
    });

    expect(prompt.full).toContain("Feature context:");
    expect(prompt.full).toContain("Feature: Checkout");
    expect(prompt.full).toContain("Description: Payment confirmation flow");

    const rulesIndex = prompt.full.indexOf("Writing rules (Company Base):");
    const featureIndex = prompt.full.indexOf("Feature context:");
    const historyIndex = prompt.full.indexOf("Conversation history:");
    expect(rulesIndex).toBeLessThan(featureIndex);
    expect(featureIndex).toBeLessThan(historyIndex);
  });

  it("omits feature context when both fields are absent", () => {
    const prompt = buildCopywriterPrompt({
      companyBase: "Company rules",
      userText: "New copy"
    });

    expect(prompt.full).not.toContain("Feature context:");
  });
});
