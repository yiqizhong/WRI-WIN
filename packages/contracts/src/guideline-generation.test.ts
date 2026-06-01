import { describe, expect, it } from "vitest";

import { devinProviderSettingsSchema } from "./devin-provider";
import {
  figmaGuidelineGenerationRequestSchema,
  figmaGuidelineGenerationResponseSchema,
  parseGenerationSummary,
  parseSemanticAnalysis,
  semanticAnalysisSchema
} from "./guideline-generation";

describe("guideline generation contracts", () => {
  it("accepts semantic analysis with degraded metadata", () => {
    const parsed = parseSemanticAnalysis({
      selectedSampleIds: ["s1", "s2"],
      duplicateGroups: [{ canonicalSampleId: "s1", duplicateSampleIds: ["s3"] }],
      terminology: ["CTA", "checkout"],
      observations: [{ category: "tone", note: "too formal", confidence: 0.82 }],
      selectedEvidence: [{ sampleId: "s1", reason: "primary funnel copy" }],
      coverageGaps: ["error-state copy is sparse"],
      confidenceNotes: ["navigation labels are consistent"],
      status: "fallback",
      degradedPath: {
        stage: "semantic_analysis",
        reason: "provider timeout",
        limitations: ["used deterministic fallback ranking"]
      }
    });

    expect(parsed.status).toBe("fallback");
    expect(parsed.degradedPath?.stage).toBe("semantic_analysis");
  });

  it("rejects semantic analysis confidence outside [0,1]", () => {
    expect(() =>
      semanticAnalysisSchema.parse({
        selectedSampleIds: ["s1"],
        duplicateGroups: [],
        terminology: [],
        observations: [{ category: "tone", note: "bad", confidence: 1.5 }],
        selectedEvidence: [],
        coverageGaps: [],
        confidenceNotes: []
      })
    ).toThrow();
  });

  it("parses enriched generation summary", () => {
    const parsed = parseGenerationSummary({
      candidateCount: 500,
      selectedCount: 132,
      categoryDistribution: {
        headline: 52,
        body: 120,
        cta: 38,
        label: 71,
        navigation: 64,
        form: 91,
        other: 64
      },
      semanticAnalysisStatus: "applied",
      confidence: "medium-high",
      limitations: ["no screenshot context"]
    });

    expect(parsed.selectedCount).toBe(132);
    expect(parsed.semanticAnalysisStatus).toBe("applied");
  });

  it("accepts devin provider settings defaults", () => {
    const parsed = devinProviderSettingsSchema.parse({});
    expect(parsed.modelId).toBe("swe-1.6");
    expect(parsed.reasoningPreference).toBe("medium");
    expect(parsed.reasoningCapabilityStatus).toBe("advisory");
  });

  it("accepts guideline generation request/response payloads", () => {
    const request = figmaGuidelineGenerationRequestSchema.parse({ sessionId: "sess-1" });
    expect(request.maxCandidates).toBe(500);

    const response = figmaGuidelineGenerationResponseSchema.parse({
      ok: true,
      sessionId: "sess-1",
      diagnostics: [],
      files: [
        { name: "background.md", mimeType: "text/markdown", content: "# Product background\n" },
        {
          name: "glossary.csv",
          mimeType: "text/csv",
          content: "term,definition,preferred,avoid,usage_context,example\n"
        },
        { name: "writing-guide.md", mimeType: "text/markdown", content: "# Writing guide\n" },
        { name: "generation-summary.md", mimeType: "text/markdown", content: "# Summary\n" }
      ]
    });
    expect(response.ok).toBe(true);
    expect(response.files).toHaveLength(4);
  });
});
