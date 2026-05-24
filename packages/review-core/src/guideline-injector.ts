import {
  isLegacyGuidelineSnapshot,
  type GuidelineSnapshot,
  type Rule,
  type SessionGuidelineSnapshot,
  type Surface,
  type Term,
  type ThreeLayerGuidelineSnapshot
} from "@writer/contracts";

export type InjectedGuidelineContext = {
  rulesBlock: string;
  glossaryBlock: string;
  proseBlock: string;
};

function formatRules(rules: Rule[], heading: string): string {
  if (rules.length === 0) return "";
  return [
    heading,
    ...rules.map(
      (r) =>
        `- [${r.severity.toUpperCase()}] ${r.id}: ${r.do}${r.dont ? ` (avoid: ${r.dont})` : ""}${r.reason ? ` — ${r.reason}` : ""}`
    )
  ].join("\n");
}

function formatGlossary(terms: Term[], auditedText: string): string {
  const textLower = auditedText.toLowerCase();
  const matching = terms.filter((term) => {
    const candidates = term.forbidden?.length ? term.forbidden : [term.term];
    return candidates.some((c) =>
      term.caseSensitive ? auditedText.includes(c) : textLower.includes(c.toLowerCase())
    );
  });
  if (matching.length === 0) return "";
  return [
    "## Glossary",
    ...matching.map(
      (t) =>
        `- Prefer "${t.term}"; avoid: ${(t.forbidden ?? []).join(", ")}${t.reason ? ` — ${t.reason}` : ""}`
    )
  ].join("\n");
}

function mergeGlossaryById(company: Term[], product: Term[]): Term[] {
  const byId = new Map<string, Term>();
  for (const term of company) byId.set(term.id, term);
  for (const term of product) byId.set(term.id, term);
  return [...byId.values()];
}

function injectLegacy(
  snapshot: GuidelineSnapshot,
  surface: Surface,
  auditedText: string
): InjectedGuidelineContext {
  const { guideline } = snapshot;
  const matchingRules = guideline.rules.filter((r) => r.surfaces.includes(surface));
  const rulesBlock = formatRules(matchingRules, "## Applicable Rules");
  const glossaryBlock = formatGlossary(guideline.glossary, auditedText);
  return { rulesBlock, glossaryBlock, proseBlock: guideline.body?.trim() ?? "" };
}

function injectThreeLayer(
  snapshot: ThreeLayerGuidelineSnapshot,
  surface: Surface,
  auditedText: string
): InjectedGuidelineContext {
  const proseParts: string[] = [];

  const brandBody = snapshot.companyBase?.body?.trim();
  if (brandBody) {
    proseParts.push("# Brand voice", brandBody);
  }

  const product = snapshot.productPackage;
  if (product) {
    const { background } = product;
    proseParts.push(
      `# Product context: ${background.name}`,
      `- Audience: ${background.audience}`,
      `- Environment: ${background.environment}`,
      `- Purpose: ${background.purpose}`,
      "",
      background.body.trim()
    );
  }

  const ruleParts: string[] = [];
  const softwareRules =
    snapshot.softwareWriting?.rules.filter((r) => r.surfaces.includes(surface)) ?? [];
  if (softwareRules.length > 0) {
    ruleParts.push(formatRules(softwareRules, "# Software writing rules"));
  }
  const productRules =
    product?.writingGuide?.rules.filter((r) => r.surfaces.includes(surface)) ?? [];
  if (productRules.length > 0) {
    ruleParts.push(formatRules(productRules, "# Product-specific rules"));
  }

  const mergedGlossary = mergeGlossaryById(
    snapshot.companyGlossary,
    product?.glossary ?? []
  );
  const glossaryBlock = formatGlossary(mergedGlossary, auditedText);

  return {
    proseBlock: proseParts.join("\n\n"),
    rulesBlock: ruleParts.join("\n\n"),
    glossaryBlock
  };
}

export function injectGuidelineContext(
  snapshot: SessionGuidelineSnapshot,
  surface: Surface,
  auditedText: string
): InjectedGuidelineContext {
  if (isLegacyGuidelineSnapshot(snapshot)) {
    return injectLegacy(snapshot, surface, auditedText);
  }
  return injectThreeLayer(snapshot, surface, auditedText);
}

export function buildGuidelinePromptSection(ctx: InjectedGuidelineContext): string {
  const parts = [ctx.proseBlock, ctx.rulesBlock, ctx.glossaryBlock].filter(Boolean);
  return parts.length === 0 ? "" : `\n\n# UX Writing Guidelines\n\n${parts.join("\n\n")}`;
}
