import { describe, expect, it } from "vitest";

import { buildGuidelineCandidatePackage, buildDeterministicSemanticAnalysis } from "./guideline-generation";
import {
  buildCandidatePackageForBatch,
  chunkGuidelineCandidateSamples,
  GUIDELINE_SEMANTIC_BATCH_SIZE,
  mergeSemanticAnalyses
} from "./semantic-analysis-batch";

describe("semantic analysis batching", () => {
  it("chunks samples into batches of 100", () => {
    const samples = Array.from({ length: 250 }, (_, index) => ({
      id: `node-${index}`,
      characters: `Label ${index}`,
      path: ["Page", `Frame ${index % 3}`]
    }));
    const candidatePackage = buildGuidelineCandidatePackage(samples, 250);
    const batches = chunkGuidelineCandidateSamples(candidatePackage.samples);

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(100);
    expect(batches[1]).toHaveLength(100);
    expect(batches[2]).toHaveLength(50);
  });

  it("merges batch partial analyses into one semantic analysis", () => {
    const candidatePackage = buildGuidelineCandidatePackage(
      [
        { id: "a", characters: "Continue", path: ["Checkout"] },
        { id: "b", characters: "Save changes", path: ["Settings"] },
        { id: "c", characters: "Order summary", path: ["Summary"] }
      ],
      3
    );

    const batchA = buildDeterministicSemanticAnalysis(
      buildCandidatePackageForBatch(candidatePackage, [candidatePackage.samples[0]!], 0, 2)
    );
    const batchB = buildDeterministicSemanticAnalysis(
      buildCandidatePackageForBatch(
        candidatePackage,
        candidatePackage.samples.slice(1),
        1,
        2
      )
    );

    const merged = mergeSemanticAnalyses({
      candidatePackage,
      parts: [batchA, batchB],
      llmBatchCount: 2,
      deterministicBatchCount: 0,
      batchCount: 2
    });

    expect(merged.selectedSampleIds.length).toBeGreaterThan(0);
    expect(merged.confidenceNotes[0]).toContain("2 batch");
    expect(merged.status).toBe("applied");
  });

  it("uses default batch size of 100", () => {
    expect(GUIDELINE_SEMANTIC_BATCH_SIZE).toBe(100);
  });
});
