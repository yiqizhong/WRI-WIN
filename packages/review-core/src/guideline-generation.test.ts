import { describe, expect, it } from "vitest";

import {
  buildDeterministicGuidelineDraft,
  buildDeterministicSemanticAnalysis,
  buildGuidelineCandidatePackage,
  buildGuidelineGenerationSummary
} from "./guideline-generation";
import { renderGuidelineStarterPack } from "./guideline-generator-renderer";

describe("figma guideline generation helpers", () => {
  it("builds capped candidate package with categories and coverage metadata", () => {
    const candidatePackage = buildGuidelineCandidatePackage(
      Array.from({ length: 700 }).map((_, index) => ({
        id: `node-${index}`,
        characters: `Sample text ${index}`,
        path: ["Checkout", `Frame ${index % 5}`]
      })),
      500
    );

    expect(candidatePackage.samples).toHaveLength(500);
    expect(candidatePackage.totalCandidates).toBe(500);
    expect(candidatePackage.coverageMetadata.pageCount).toBeGreaterThan(0);
    expect(candidatePackage.samples[0]?.occurrenceCount).toBeGreaterThanOrEqual(1);
  });

  it("deduplicates repeated text while preserving occurrence counts", () => {
    const candidatePackage = buildGuidelineCandidatePackage([
      { id: "a", characters: "Save changes", path: ["Checkout", "Frame A"] },
      { id: "b", characters: "Save changes", path: ["Settings", "Frame B"] },
      { id: "c", characters: "Order summary", path: ["Summary", "Frame C"] }
    ]);

    const saveSample = candidatePackage.samples.find((item) => item.normalizedText === "save changes");
    expect(saveSample?.occurrenceCount).toBe(2);
  });

  it("generates deterministic semantic analysis, draft, and starter pack files", () => {
    const candidatePackage = buildGuidelineCandidatePackage([
      { id: "a", characters: "Continue to checkout", path: ["Checkout", "Frame 1"] },
      { id: "b", characters: "Continue to checkout", path: ["Checkout", "Frame 2"] },
      { id: "c", characters: "Order summary", path: ["Summary", "Frame 3"] }
    ]);
    const semantic = buildDeterministicSemanticAnalysis(candidatePackage);
    const draft = buildDeterministicGuidelineDraft(candidatePackage, semantic);
    const summary = buildGuidelineGenerationSummary(candidatePackage, semantic);
    const files = renderGuidelineStarterPack({
      draft,
      summary: {
        sourceLabel: "Figma session",
        scopeLabel: "Checkout flow",
        pageCount: candidatePackage.coverageMetadata.pageCount,
        frameCount: candidatePackage.coverageMetadata.frameCount,
        textSampleCount: candidatePackage.totalCandidates,
        candidateCount: candidatePackage.totalCandidates,
        selectedCount: semantic.selectedSampleIds.length,
        categoryDistribution: candidatePackage.categoryDistribution,
        semanticAnalysisStatus: semantic.status,
        confidenceNotes: semantic.confidenceNotes,
        limitations: summary.limitations
      }
    });

    expect(semantic.selectedSampleIds.length).toBeGreaterThan(0);
    expect(summary.candidateCount).toBe(candidatePackage.totalCandidates);
    expect(files.map((file) => file.name)).toEqual([
      "background.md",
      "glossary.csv",
      "writing-guide.md",
      "generation-summary.md"
    ]);
    expect(files.find((file) => file.name === "glossary.csv")?.content).toContain(
      "term,definition,preferred,avoid,usage_context,example"
    );
  });
});
