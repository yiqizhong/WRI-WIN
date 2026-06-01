import type {
  FigmaGuidelineDraft,
  FigmaGuidelineGeneratedFile,
  FigmaGuidelineStarterPackSummary
} from "@writer/contracts";

function csvEscape(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function renderGuidelineStarterPack(input: {
  draft: FigmaGuidelineDraft;
  summary: FigmaGuidelineStarterPackSummary;
}): FigmaGuidelineGeneratedFile[] {
  const { draft, summary } = input;
  const glossaryRows = [
    ["term", "definition", "preferred", "avoid", "usage_context", "example"],
    ...draft.glossary.map((entry) => [
      entry.term,
      entry.definition,
      entry.preferred,
      entry.avoid,
      entry.usageContext,
      entry.example
    ])
  ];

  const categoryLines = Object.entries(summary.categoryDistribution)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => `- ${category}: ${count}`);

  return [
    {
      name: "background.md",
      mimeType: "text/markdown",
      content: [
        "# Product background",
        "",
        "## Context",
        draft.productContext,
        "",
        "## Audience",
        draft.audience,
        "",
        "## Voice",
        ...draft.voice.map((item) => `- ${item}`),
        "",
        "## Tone by situation",
        ...draft.toneBySituation.map((item) => `- ${item.situation}: ${item.tone}`),
        "",
        "## Desired user feeling",
        ...draft.desiredUserFeeling.map((item) => `- ${item}`)
      ].join("\n")
    },
    {
      name: "glossary.csv",
      mimeType: "text/csv",
      content: `${glossaryRows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`
    },
    {
      name: "writing-guide.md",
      mimeType: "text/markdown",
      content: [
        "# Product writing guide",
        "",
        "## Writing principles",
        ...draft.writingPrinciples.map((item) => `- ${item}`),
        "",
        "## UI scenario rules",
        ...draft.uiScenarioRules.map((item) => `- ${item.scenario}: ${item.guidance}`),
        "",
        "## Style conventions",
        ...draft.styleConventions.map((item) => `- ${item}`),
        "",
        "## Accessibility and localization",
        ...draft.accessibilityAndLocalizationNotes.map((item) => `- ${item}`),
        "",
        "## Do / don't examples",
        ...draft.doDontExamples.map(
          (item) => `- Do: ${item.do}\n  Don't: ${item.dont}\n  Reason: ${item.reason}`
        )
      ].join("\n")
    },
    {
      name: "generation-summary.md",
      mimeType: "text/markdown",
      content: [
        "# Generation summary",
        "",
        `Source: ${summary.sourceLabel}`,
        `Scope: ${summary.scopeLabel}`,
        `Pages: ${summary.pageCount}`,
        `Frames: ${summary.frameCount}`,
        `Text samples: ${summary.textSampleCount}`,
        `Candidates: ${summary.candidateCount}`,
        `Selected evidence: ${summary.selectedCount}`,
        `Semantic analysis: ${summary.semanticAnalysisStatus}`,
        "",
        "This is an AI-generated starter pack intended for human refinement.",
        "",
        "## Category distribution",
        ...(categoryLines.length > 0 ? categoryLines : ["- No category distribution available."]),
        "",
        "## Confidence notes",
        ...(summary.confidenceNotes.length > 0
          ? summary.confidenceNotes.map((item) => `- ${item}`)
          : ["- No confidence notes recorded."]),
        "",
        "## Limitations",
        ...(summary.limitations.length > 0
          ? summary.limitations.map((item) => `- ${item}`)
          : ["- None recorded."])
      ].join("\n")
    }
  ];
}
