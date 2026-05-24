import type { GuidelineSnapshot, Surface } from "@writer/contracts";

const PROSE_TOP_K = 5;

export type InjectedGuidelineContext = {
  rulesBlock: string;
  glossaryBlock: string;
  proseBlock: string;
};

function keywordScore(text: string, queryTokens: string[]): number {
  const lower = text.toLowerCase();
  return queryTokens.reduce((n, t) => n + (lower.includes(t) ? 1 : 0), 0);
}

export function injectGuidelineContext(
  snapshot: GuidelineSnapshot,
  surface: Surface,
  auditedText: string
): InjectedGuidelineContext {
  const { guideline } = snapshot;

  const matchingRules = guideline.rules.filter((r) => r.surfaces.includes(surface));
  const rulesBlock =
    matchingRules.length === 0
      ? ""
      : [
          "## Applicable Rules",
          ...matchingRules.map(
            (r) =>
              `- [${r.severity.toUpperCase()}] ${r.id}: ${r.do}${r.dont ? ` (avoid: ${r.dont})` : ""}${r.reason ? ` — ${r.reason}` : ""}`
          )
        ].join("\n");

  const textLower = auditedText.toLowerCase();
  const matchingTerms = guideline.glossary.filter((term) => {
    const candidates = term.forbidden ?? [];
    return candidates.some((c) =>
      term.caseSensitive ? auditedText.includes(c) : textLower.includes(c.toLowerCase())
    );
  });
  const glossaryBlock =
    matchingTerms.length === 0
      ? ""
      : [
          "## Glossary",
          ...matchingTerms.map(
            (t) =>
              `- Prefer "${t.term}"; avoid: ${(t.forbidden ?? []).join(", ")}${t.reason ? ` — ${t.reason}` : ""}`
          )
        ].join("\n");

  const proseBlock = "";

  return { rulesBlock, glossaryBlock, proseBlock };
}

export function buildGuidelinePromptSection(ctx: InjectedGuidelineContext): string {
  const parts = [ctx.rulesBlock, ctx.glossaryBlock, ctx.proseBlock].filter(Boolean);
  return parts.length === 0 ? "" : `\n\n# UX Writing Guidelines\n\n${parts.join("\n\n")}`;
}
