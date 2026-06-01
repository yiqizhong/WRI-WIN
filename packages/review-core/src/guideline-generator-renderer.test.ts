import { describe, expect, it } from "vitest";

import { renderGuidelineStarterPack } from "./guideline-generator-renderer";

describe("guideline starter pack renderer", () => {
  it("renders the four downloadable files", () => {
    const files = renderGuidelineStarterPack({
      draft: {
        productContext: "Checkout for small business owners.",
        audience: "Busy operators.",
        voice: ["clear", "calm"],
        toneBySituation: [{ situation: "errors", tone: "helpful and direct" }],
        desiredUserFeeling: ["in control"],
        glossary: [
          {
            term: "workspace",
            definition: "Shared account area",
            preferred: "workspace",
            avoid: "project space",
            usageContext: "navigation",
            example: "Open workspace"
          }
        ],
        writingPrinciples: ["Lead with the action."],
        uiScenarioRules: [{ scenario: "CTA", guidance: "Use verb-first labels." }],
        styleConventions: ["Use sentence-style capitalization."],
        accessibilityAndLocalizationNotes: ["Avoid idioms."],
        doDontExamples: [
          { do: "Try again", dont: "The action failed", reason: "Gives the next step." }
        ]
      },
      summary: {
        sourceLabel: "Figma session sess-1",
        scopeLabel: "Checkout page",
        pageCount: 2,
        frameCount: 8,
        textSampleCount: 42,
        candidateCount: 42,
        selectedCount: 15,
        categoryDistribution: {
          headline: 4,
          body: 10,
          cta: 6,
          label: 5,
          navigation: 4,
          form: 8,
          other: 5
        },
        semanticAnalysisStatus: "applied",
        confidenceNotes: ["Navigation labels are consistent."],
        limitations: ["Generated from sampled UI text."]
      }
    });

    expect(files.map((file) => file.name)).toEqual([
      "background.md",
      "glossary.csv",
      "writing-guide.md",
      "generation-summary.md"
    ]);
    expect(files.find((file) => file.name === "glossary.csv")?.content).toContain(
      "term,definition,preferred,avoid,usage_context,example"
    );
    expect(files.find((file) => file.name === "generation-summary.md")?.content).toContain(
      "Semantic analysis: applied"
    );
  });
});
