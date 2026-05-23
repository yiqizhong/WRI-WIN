import { describe, expect, it } from "vitest";

import { classifySeverity, formatRationale, isLowConfidence } from "./severity";

describe("severity classification", () => {
  it("classifies high-confidence actionability as major", () => {
    const severity = classifySeverity({
      issueType: "actionability",
      confidence: 0.9
    });

    expect(severity).toBe("major");
  });

  it("formats rationale with user impact", () => {
    const rationale = formatRationale("clarity", "The CTA is vague.");
    expect(rationale).toContain("comprehension");
    expect(rationale).toContain("The CTA is vague.");
  });

  it("flags low confidence", () => {
    expect(isLowConfidence(0.4)).toBe(true);
  });
});
