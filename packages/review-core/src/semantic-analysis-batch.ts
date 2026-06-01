import {
  semanticAnalysisSchema,
  type GuidelineCandidatePackage,
  type GuidelineCandidateSample,
  type SemanticAnalysis,
  type SemanticDuplicateGroup,
  type SemanticObservation
} from "@writer/contracts";

export const GUIDELINE_SEMANTIC_BATCH_SIZE = 100;

export function chunkGuidelineCandidateSamples(
  samples: GuidelineCandidateSample[],
  batchSize = GUIDELINE_SEMANTIC_BATCH_SIZE
): GuidelineCandidateSample[][] {
  if (samples.length === 0) {
    return [];
  }

  const batches: GuidelineCandidateSample[][] = [];
  for (let index = 0; index < samples.length; index += batchSize) {
    batches.push(samples.slice(index, index + batchSize));
  }
  return batches;
}

export function buildCandidatePackageForBatch(
  candidatePackage: GuidelineCandidatePackage,
  batchSamples: GuidelineCandidateSample[],
  batchIndex: number,
  batchCount: number
): GuidelineCandidatePackage & {
  batchIndex: number;
  batchCount: number;
  batchSampleCount: number;
} {
  const categoryDistribution = emptyCategoryDistribution();
  const uniquePages = new Set<string>();
  const uniqueFrames = new Set<string>();

  for (const sample of batchSamples) {
    categoryDistribution[sample.category] += 1;
    if (sample.pageName) uniquePages.add(sample.pageName);
    if (sample.frameName) uniqueFrames.add(sample.frameName);
  }

  return {
    ...candidatePackage,
    batchIndex: batchIndex + 1,
    batchCount,
    batchSampleCount: batchSamples.length,
    totalCandidates: candidatePackage.totalCandidates,
    selectedCandidates: batchSamples.length,
    categoryDistribution,
    coverageMetadata: {
      pageCount: uniquePages.size,
      frameCount: uniqueFrames.size,
      uniquePages: [...uniquePages].sort(),
      uniqueFrames: [...uniqueFrames].sort()
    },
    samples: batchSamples
  };
}

export type MergeSemanticAnalysesInput = {
  candidatePackage: GuidelineCandidatePackage;
  parts: SemanticAnalysis[];
  llmBatchCount: number;
  deterministicBatchCount: number;
  batchCount: number;
};

export function mergeSemanticAnalyses(input: MergeSemanticAnalysesInput): SemanticAnalysis {
  const { candidatePackage, parts, llmBatchCount, deterministicBatchCount, batchCount } = input;
  const validSampleIds = new Set(candidatePackage.samples.map((sample) => sample.sampleId));

  const terminology = mergeTerminology(parts);
  const duplicateGroups = mergeDuplicateGroups(parts, validSampleIds);
  const observations = mergeObservations(parts).slice(0, 40);
  const selectedEvidence = mergeSelectedEvidence(parts, validSampleIds).slice(0, 56);
  const coverageGaps = [...new Set(parts.flatMap((part) => part.coverageGaps))].slice(0, 24);
  const selectedSampleIds = mergeSelectedSampleIds(
    parts,
    selectedEvidence,
    validSampleIds,
    candidatePackage.selectedCandidates
  );

  const confidenceNotes = [
    `Merged ${batchCount} batch(es): ${llmBatchCount} Devin, ${deterministicBatchCount} deterministic.`,
    `Full candidate set: ${candidatePackage.totalCandidates} samples across ${candidatePackage.coverageMetadata.pageCount} pages.`,
    ...parts.flatMap((part) => part.confidenceNotes).slice(0, 6)
  ];

  const status =
    llmBatchCount === 0
      ? "fallback"
      : deterministicBatchCount > 0
        ? "applied"
        : "applied";

  const degradedPath =
    deterministicBatchCount > 0
      ? {
          stage: "semantic_analysis" as const,
          reason: "partial_batch_fallback",
          limitations: [
            `${deterministicBatchCount} of ${batchCount} batches used deterministic clustering after Devin returned invalid output.`
          ]
        }
      : undefined;

  return semanticAnalysisSchema.parse({
    selectedSampleIds,
    duplicateGroups,
    terminology,
    observations,
    selectedEvidence,
    coverageGaps,
    confidenceNotes,
    status,
    degradedPath
  });
}

export function filterSemanticAnalysisToSampleIds(
  analysis: SemanticAnalysis,
  validSampleIds: Set<string>
): SemanticAnalysis {
  return semanticAnalysisSchema.parse({
    ...analysis,
    selectedSampleIds: analysis.selectedSampleIds.filter((id) => validSampleIds.has(id)),
    duplicateGroups: analysis.duplicateGroups
      .map((group) => ({
        ...group,
        duplicateSampleIds: group.duplicateSampleIds.filter((id) => validSampleIds.has(id))
      }))
      .filter(
        (group) =>
          validSampleIds.has(group.canonicalSampleId) || group.duplicateSampleIds.length > 0
      ),
    selectedEvidence: analysis.selectedEvidence.filter((item) => validSampleIds.has(item.sampleId))
  });
}

function emptyCategoryDistribution(): Record<
  GuidelineCandidateSample["category"],
  number
> {
  return {
    headline: 0,
    body: 0,
    cta: 0,
    label: 0,
    navigation: 0,
    form: 0,
    other: 0
  };
}

function mergeTerminology(parts: SemanticAnalysis[]): string[] {
  const counts = new Map<string, number>();
  for (const part of parts) {
    for (const term of part.terminology) {
      const normalized = term.trim();
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term)
    .slice(0, 32);
}

function mergeDuplicateGroups(
  parts: SemanticAnalysis[],
  validSampleIds: Set<string>
): SemanticDuplicateGroup[] {
  const byCanonical = new Map<string, Set<string>>();

  for (const part of parts) {
    for (const group of part.duplicateGroups) {
      if (!validSampleIds.has(group.canonicalSampleId)) {
        continue;
      }
      const dupes = byCanonical.get(group.canonicalSampleId) ?? new Set<string>();
      for (const duplicateSampleId of group.duplicateSampleIds) {
        if (validSampleIds.has(duplicateSampleId) && duplicateSampleId !== group.canonicalSampleId) {
          dupes.add(duplicateSampleId);
        }
      }
      byCanonical.set(group.canonicalSampleId, dupes);
    }
  }

  return [...byCanonical.entries()]
    .filter(([, duplicateSampleIds]) => duplicateSampleIds.size > 0)
    .map(([canonicalSampleId, duplicateSampleIds]) => ({
      canonicalSampleId,
      duplicateSampleIds: [...duplicateSampleIds]
    }));
}

function mergeObservations(parts: SemanticAnalysis[]): SemanticObservation[] {
  const seen = new Set<string>();
  const merged: SemanticObservation[] = [];

  for (const part of parts) {
    for (const observation of part.observations) {
      const key = `${observation.category}::${observation.note.trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(observation);
    }
  }

  return merged.sort((a, b) => b.confidence - a.confidence);
}

function mergeSelectedEvidence(
  parts: SemanticAnalysis[],
  validSampleIds: Set<string>
): SemanticAnalysis["selectedEvidence"] {
  const bySampleId = new Map<string, SemanticAnalysis["selectedEvidence"][number]>();

  for (const part of parts) {
    for (const evidence of part.selectedEvidence) {
      if (!validSampleIds.has(evidence.sampleId)) continue;
      if (!bySampleId.has(evidence.sampleId)) {
        bySampleId.set(evidence.sampleId, evidence);
      }
    }
  }

  return [...bySampleId.values()];
}

function mergeSelectedSampleIds(
  parts: SemanticAnalysis[],
  selectedEvidence: SemanticAnalysis["selectedEvidence"],
  validSampleIds: Set<string>,
  targetCount: number
): string[] {
  const ordered: string[] = [];

  for (const evidence of selectedEvidence) {
    if (!ordered.includes(evidence.sampleId)) {
      ordered.push(evidence.sampleId);
    }
  }

  for (const part of parts) {
    for (const sampleId of part.selectedSampleIds) {
      if (!validSampleIds.has(sampleId)) continue;
      if (!ordered.includes(sampleId)) {
        ordered.push(sampleId);
      }
    }
  }

  return ordered.slice(0, targetCount);
}
