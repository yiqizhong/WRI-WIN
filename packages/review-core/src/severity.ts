import type { IssueSeverity, IssueType } from "@writer/contracts";

export type SeverityInput = {
  issueType: IssueType;
  confidence: number;
  textLength?: number;
};

export function classifySeverity(input: SeverityInput): IssueSeverity {
  if (input.confidence < 0.45) {
    return "suggestion";
  }

  if (input.issueType === "accessibility" || input.issueType === "actionability") {
    return input.confidence > 0.75 ? "major" : "minor";
  }

  if (input.issueType === "grammar" && (input.textLength ?? 0) < 12) {
    return "minor";
  }

  return input.confidence > 0.85 ? "major" : "minor";
}

export function formatRationale(issueType: IssueType, detail: string): string {
  const impact: Record<IssueType, string> = {
    tone: "Tone may confuse users about intent.",
    clarity: "Copy may slow comprehension for first-time users.",
    consistency: "Inconsistent wording can reduce trust across the flow.",
    terminology: "Terminology may not match product vocabulary.",
    actionability: "Users may hesitate to take the next step.",
    accessibility: "Copy may be harder to scan or understand.",
    grammar: "Grammar issues can reduce perceived quality."
  };

  return `${impact[issueType]} ${detail}`.trim();
}

export function isLowConfidence(confidence: number): boolean {
  return confidence < 0.55;
}
