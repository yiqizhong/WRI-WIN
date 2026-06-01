import type {
  DegradedPath,
  FigmaGuidelineDraft,
  FigmaGuidelineStarterPackSummary,
  GenerationSummary,
  GuidelineCandidateCategory,
  GuidelineCandidatePackage,
  GuidelineCandidateSample,
  SemanticAnalysis
} from "@writer/contracts";
import {
  figmaGuidelineDraftSchema,
  generationSummarySchema,
  guidelineCandidatePackageSchema,
  semanticAnalysisSchema
} from "@writer/contracts";

type SourceNode = {
  id: string;
  characters: string;
  path?: string[];
};

const CATEGORY_RULES: Array<{ category: GuidelineCandidateCategory; regex: RegExp }> = [
  { category: "cta", regex: /\b(buy|continue|start|submit|save|confirm|checkout|next|create|try|download)\b/i },
  { category: "headline", regex: /^[A-Z][^\n]{0,80}$/ },
  { category: "navigation", regex: /\b(menu|home|settings|account|profile|back|close|cancel)\b/i },
  { category: "form", regex: /\b(email|password|phone|address|required|optional|name)\b/i },
  { category: "label", regex: /^[A-Za-z][A-Za-z0-9\s]{1,28}$/ },
  { category: "body", regex: /\s/ }
];

const LOW_SIGNAL_NAV_CTA = new Set(["ok", "go", "x", ">", "<", "back", "next", "menu", "home"]);

export function buildGuidelineCandidatePackage(
  nodes: SourceNode[],
  maxCandidates = 500
): GuidelineCandidatePackage {
  const aggregated = new Map<
    string,
    GuidelineCandidateSample & { pages: Set<string>; frames: Set<string> }
  >();

  for (const node of nodes) {
    const normalizedText = normalizeCopy(node.characters);
    if (!normalizedText || isLowSignalCopy(normalizedText)) {
      continue;
    }

    const { pageName, frameName } = parsePathContext(node.path);
    const category = inferCategory(normalizedText, node.characters);
    const key = `${normalizedText}::${category}`;

    const existing = aggregated.get(key);
    if (existing) {
      existing.occurrenceCount += 1;
      if (pageName) existing.pages.add(pageName);
      if (frameName) existing.frames.add(frameName);
      continue;
    }

    aggregated.set(key, {
      sampleId: `sample-${aggregated.size + 1}`,
      nodeId: node.id,
      text: node.characters.trim(),
      normalizedText,
      category,
      framePath: node.path?.join(" / ") || "Unknown frame",
      pageName,
      frameName,
      nodeName: node.path?.at(-1),
      occurrenceCount: 1,
      pages: new Set(pageName ? [pageName] : []),
      frames: new Set(frameName ? [frameName] : [])
    });
  }

  const ranked = [...aggregated.values()].sort((a, b) => {
    const scoreA = sampleRankScore(a);
    const scoreB = sampleRankScore(b);
    return scoreB - scoreA || a.normalizedText.localeCompare(b.normalizedText);
  });

  const balanced = selectBalancedSamples(ranked, maxCandidates);
  const categoryDistribution = emptyCategoryDistribution();
  const uniquePages = new Set<string>();
  const uniqueFrames = new Set<string>();

  const samples: GuidelineCandidateSample[] = balanced.map((item, index) => {
    categoryDistribution[item.category] += 1;
    for (const page of item.pages) uniquePages.add(page);
    for (const frame of item.frames) uniqueFrames.add(frame);

    const { pages: _pages, frames: _frames, ...sample } = item;
    return { ...sample, sampleId: `sample-${index + 1}` };
  });

  const selectedCandidates = Math.min(
    samples.length,
    Math.max(30, Math.floor(samples.length * 0.35))
  );

  return guidelineCandidatePackageSchema.parse({
    maxCandidates,
    totalCandidates: samples.length,
    selectedCandidates,
    categoryDistribution,
    coverageMetadata: {
      pageCount: uniquePages.size,
      frameCount: uniqueFrames.size,
      uniquePages: [...uniquePages].sort(),
      uniqueFrames: [...uniqueFrames].sort()
    },
    samples
  });
}

export function buildDeterministicSemanticAnalysis(
  candidatePackage: GuidelineCandidatePackage,
  degradedPath?: DegradedPath
): SemanticAnalysis {
  const byNormalized = new Map<string, GuidelineCandidateSample[]>();
  for (const sample of candidatePackage.samples) {
    const list = byNormalized.get(sample.normalizedText) ?? [];
    list.push(sample);
    byNormalized.set(sample.normalizedText, list);
  }

  const duplicateGroups = [...byNormalized.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      canonicalSampleId: group[0]!.sampleId,
      duplicateSampleIds: group.slice(1).map((item) => item.sampleId)
    }));

  const selected = selectEvidenceSamples(candidatePackage);
  const terminology = extractTerminology(selected);
  const observations = buildObservations(candidatePackage);

  return semanticAnalysisSchema.parse({
    selectedSampleIds: selected.map((item) => item.sampleId),
    duplicateGroups,
    terminology,
    observations,
    selectedEvidence: selected.slice(0, 24).map((item) => ({
      sampleId: item.sampleId,
      reason: `Representative ${item.category} copy from ${item.framePath} (${item.occurrenceCount}×)`
    })),
    coverageGaps: buildCoverageGaps(candidatePackage),
    confidenceNotes: [
      `Selected ${selected.length} evidence samples from ${candidatePackage.totalCandidates} candidates.`,
      `Coverage spans ${candidatePackage.coverageMetadata.pageCount} pages and ${candidatePackage.coverageMetadata.frameCount} frames.`,
      degradedPath
        ? "Deterministic semantic pass used after LLM fallback."
        : "Deterministic semantic pass used lexical clustering."
    ],
    status: degradedPath ? "fallback" : "applied",
    degradedPath
  });
}

export function buildDeterministicGuidelineDraft(
  candidatePackage: GuidelineCandidatePackage,
  semanticAnalysis: SemanticAnalysis
): FigmaGuidelineDraft {
  const evidence = candidatePackage.samples.filter((sample) =>
    semanticAnalysis.selectedSampleIds.includes(sample.sampleId)
  );
  const topTerms = semanticAnalysis.terminology.slice(0, 12);
  const topCta = evidence.filter((item) => item.category === "cta").slice(0, 3);
  const topBody = evidence.filter((item) => item.category === "body").slice(0, 2);

  return figmaGuidelineDraftSchema.parse({
    productContext: `Generated from ${candidatePackage.totalCandidates} Figma UI text samples across ${candidatePackage.coverageMetadata.pageCount} pages.`,
    audience: "Users interacting with the selected Figma surfaces.",
    voice: ["clear", "helpful", "concise"],
    toneBySituation: [
      { situation: "errors", tone: "direct and reassuring" },
      { situation: "success", tone: "brief and positive" }
    ],
    desiredUserFeeling: ["in control", "confident about next steps"],
    glossary: topTerms.map((term) => ({
      term,
      definition: `Recurring product term observed in UI copy.`,
      preferred: term,
      avoid: "",
      usageContext: "ui copy",
      example: evidence.find((item) => item.normalizedText.includes(term))?.text ?? term
    })),
    writingPrinciples: [
      "Lead with the user action in buttons and links.",
      "Keep labels short and scannable.",
      "Use consistent terminology across navigation and forms."
    ],
    uiScenarioRules: [
      {
        scenario: "CTA",
        guidance: topCta.length
          ? `Prefer verb-first labels like "${topCta[0]!.text}".`
          : "Use verb-first labels that state the outcome."
      },
      {
        scenario: "Body copy",
        guidance: topBody.length
          ? `Keep supporting copy concise; example: "${topBody[0]!.text.slice(0, 80)}".`
          : "Keep supporting copy short and concrete."
      }
    ],
    styleConventions: [
      "Use sentence-style capitalization in labels and buttons.",
      "Avoid duplicate strings for the same action across frames."
    ],
    accessibilityAndLocalizationNotes: [
      "Avoid idioms and culture-specific references.",
      "Do not rely on color alone to communicate state."
    ],
    doDontExamples: topCta.slice(0, 2).map((item) => ({
      do: item.text,
      dont: "Click here",
      reason: "Specific action labels reduce ambiguity."
    }))
  });
}

export function buildGuidelineStarterPackSummary(input: {
  sourceLabel: string;
  scopeLabel: string;
  candidatePackage: GuidelineCandidatePackage;
  semanticAnalysis: SemanticAnalysis;
  limitations?: string[];
}): FigmaGuidelineStarterPackSummary {
  return {
    sourceLabel: input.sourceLabel,
    scopeLabel: input.scopeLabel,
    pageCount: input.candidatePackage.coverageMetadata.pageCount,
    frameCount: input.candidatePackage.coverageMetadata.frameCount,
    textSampleCount: input.candidatePackage.totalCandidates,
    candidateCount: input.candidatePackage.totalCandidates,
    selectedCount: input.semanticAnalysis.selectedSampleIds.length,
    categoryDistribution: input.candidatePackage.categoryDistribution,
    semanticAnalysisStatus: input.semanticAnalysis.status,
    confidenceNotes: input.semanticAnalysis.confidenceNotes,
    limitations: input.limitations ?? input.semanticAnalysis.degradedPath?.limitations ?? []
  };
}

export function buildGuidelineGenerationSummary(
  candidatePackage: GuidelineCandidatePackage,
  semanticAnalysis: SemanticAnalysis,
  limitations: string[] = []
): GenerationSummary {
  return generationSummarySchema.parse({
    candidateCount: candidatePackage.totalCandidates,
    selectedCount: semanticAnalysis.selectedSampleIds.length,
    categoryDistribution: candidatePackage.categoryDistribution,
    semanticAnalysisStatus: semanticAnalysis.status,
    confidence:
      semanticAnalysis.status === "applied"
        ? "medium-high"
        : semanticAnalysis.status === "fallback"
          ? "medium"
          : "low",
    limitations
  });
}

function selectEvidenceSamples(candidatePackage: GuidelineCandidatePackage): GuidelineCandidateSample[] {
  const target = candidatePackage.selectedCandidates;
  const byCategory = new Map<GuidelineCandidateCategory, GuidelineCandidateSample[]>();

  for (const sample of candidatePackage.samples) {
    const list = byCategory.get(sample.category) ?? [];
    list.push(sample);
    byCategory.set(sample.category, list);
  }

  const selected: GuidelineCandidateSample[] = [];
  const categories = [...byCategory.keys()];
  let index = 0;

  while (selected.length < target && categories.length > 0) {
    const category = categories[index % categories.length]!;
    const bucket = byCategory.get(category);
    if (!bucket || bucket.length === 0) {
      categories.splice(index % categories.length, 1);
      continue;
    }
    selected.push(bucket.shift()!);
    index += 1;
  }

  return selected.slice(0, target);
}

function selectBalancedSamples(
  ranked: Array<GuidelineCandidateSample & { pages: Set<string>; frames: Set<string> }>,
  maxCandidates: number
): Array<GuidelineCandidateSample & { pages: Set<string>; frames: Set<string> }> {
  const selected: Array<GuidelineCandidateSample & { pages: Set<string>; frames: Set<string> }> = [];
  const categoryCounts = emptyCategoryDistribution();
  const maxPerCategory = Math.max(40, Math.ceil(maxCandidates / 4));

  for (const sample of ranked) {
    if (selected.length >= maxCandidates) break;
    if (categoryCounts[sample.category] >= maxPerCategory && selected.length > maxCandidates * 0.6) {
      continue;
    }
    selected.push(sample);
    categoryCounts[sample.category] += 1;
  }

  if (selected.length < maxCandidates) {
    for (const sample of ranked) {
      if (selected.length >= maxCandidates) break;
      if (selected.some((item) => item.sampleId === sample.sampleId)) continue;
      selected.push(sample);
    }
  }

  return selected.slice(0, maxCandidates);
}

function sampleRankScore(
  sample: GuidelineCandidateSample & { pages: Set<string>; frames: Set<string> }
): number {
  let score = sample.occurrenceCount * 10;
  if (sample.category === "body" || sample.category === "headline") score += 4;
  if (sample.category === "cta" || sample.category === "navigation") score += 1;
  score += sample.pages.size + sample.frames.size;
  if (isLowSignalCopy(sample.normalizedText)) score -= 20;
  return score;
}

function isLowSignalCopy(normalizedText: string): boolean {
  if (normalizedText.length <= 1) return true;
  if (LOW_SIGNAL_NAV_CTA.has(normalizedText)) return true;
  return false;
}

function parsePathContext(path: string[] | undefined): { pageName?: string; frameName?: string } {
  if (!path || path.length === 0) {
    return {};
  }
  return {
    pageName: path[0],
    frameName: path.length > 1 ? path[1] : path[0]
  };
}

function inferCategory(text: string, raw: string): GuidelineCandidateCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.regex.test(text) || rule.regex.test(raw.trim())) {
      return rule.category;
    }
  }
  return "other";
}

function normalizeCopy(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function emptyCategoryDistribution(): Record<GuidelineCandidateCategory, number> {
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

function extractTerminology(samples: GuidelineCandidateSample[]): string[] {
  const words = new Map<string, number>();
  for (const sample of samples) {
    for (const token of sample.normalizedText.split(/[^a-z0-9]+/)) {
      if (token.length < 4) continue;
      words.set(token, (words.get(token) ?? 0) + sample.occurrenceCount);
    }
  }
  return [...words.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

function buildObservations(
  candidatePackage: GuidelineCandidatePackage
): Array<{ category: string; note: string; confidence: number }> {
  const distribution = candidatePackage.categoryDistribution;
  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  return entries.slice(0, 6).map(([category, count]) => ({
    category,
    note: `${count} samples categorized as ${category}.`,
    confidence:
      count === 0 ? 0.2 : Math.min(0.95, 0.45 + count / Math.max(1, candidatePackage.totalCandidates))
  }));
}

function buildCoverageGaps(candidatePackage: GuidelineCandidatePackage): string[] {
  const gaps: string[] = [];
  if (candidatePackage.categoryDistribution.form < 5) {
    gaps.push("Limited form/error copy examples.");
  }
  if (candidatePackage.categoryDistribution.navigation < 5) {
    gaps.push("Limited navigation labels for IA consistency checks.");
  }
  if (candidatePackage.totalCandidates < 60) {
    gaps.push("Small candidate set may reduce representativeness.");
  }
  if (candidatePackage.coverageMetadata.pageCount < 2) {
    gaps.push("Limited page coverage in the selected Figma scope.");
  }
  return gaps;
}
