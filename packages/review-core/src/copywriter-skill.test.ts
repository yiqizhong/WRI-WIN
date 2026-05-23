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
});
