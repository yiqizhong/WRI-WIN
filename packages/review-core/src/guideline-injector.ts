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
        `- [${(r.severity ?? "should").toUpperCase()}] ${r.id}: ${r.do}${r.dont ? ` (avoid: ${r.dont})` : ""}${r.reason ? ` — ${r.reason}` : ""}`
    )
  ].join("\n");
}

function formatGlossary(terms: Term[], auditedText: string): string {
  if (terms.length === 0) return "";
  const textLower = auditedText.toLowerCase();
  const matching = terms.filter((term) => {
    const candidates = term.forbidden?.length ? term.forbidden : [term.term];
    return candidates.some((c) =>
      term.caseSensitive ? auditedText.includes(c) : textLower.includes(c.toLowerCase())
    );
  });
  if (matching.length === 0) return "";
  return [
    "## Glossary (structured terms)",
    ...matching.map(
      (t) =>
        `- Prefer "${t.term}"; avoid: ${(t.forbidden ?? []).join(", ")}${t.reason ? ` — ${t.reason}` : ""}`
    )
  ].join("\n");
}

function injectLegacy(
  snapshot: GuidelineSnapshot,
  surface: Surface | undefined,
  auditedText: string
): InjectedGuidelineContext {
  const { guideline } = snapshot;
  const matchingRules =
    surface === undefined
      ? guideline.rules
      : guideline.rules.filter((r) => r.surfaces.includes(surface));
  const rulesBlock = formatRules(matchingRules, "## Applicable Rules");
  const glossaryBlock = formatGlossary(guideline.glossary, auditedText);
  return { rulesBlock, glossaryBlock, proseBlock: guideline.body?.trim() ?? "" };
}

function injectThreeLayer(
  snapshot: ThreeLayerGuidelineSnapshot,
  surface: Surface | undefined,
  auditedText: string
): InjectedGuidelineContext {
  const proseParts: string[] = [];

  const companyBody = snapshot.companyBase?.body?.trim();
  if (companyBody) {
    proseParts.push("# Company base", companyBody);
  }

  const softwareBody = snapshot.softwareWriting?.body?.trim();
  if (softwareBody) {
    proseParts.push("# Software writing", softwareBody);
  }

  const product = snapshot.productPackage;
  if (product?.background?.content.trim()) {
    proseParts.push(`# Product: ${product.background.name}`, product.background.content.trim());
  }

  if (product?.writingGuideContent?.trim()) {
    proseParts.push("# Product writing guide", product.writingGuideContent.trim());
  } else if (product?.writingGuide?.body?.trim()) {
    proseParts.push("# Product writing guide", product.writingGuide.body.trim());
  }

  for (const extra of product?.extraFiles ?? []) {
    if (extra.content.trim()) {
      proseParts.push(`# ${extra.filename}`, extra.content.trim());
    }
  }

  const ruleParts: string[] = [];
  const softwareRules =
    surface === undefined
      ? snapshot.softwareWriting?.rules ?? []
      : snapshot.softwareWriting?.rules.filter((r) => r.surfaces.includes(surface)) ?? [];
  if (softwareRules.length > 0) {
    ruleParts.push(formatRules(softwareRules, "# Software writing rules (structured)"));
  }
  const productRules =
    surface === undefined
      ? product?.writingGuide?.rules ?? []
      : product?.writingGuide?.rules.filter((r) => r.surfaces.includes(surface)) ?? [];
  if (productRules.length > 0) {
    ruleParts.push(formatRules(productRules, "# Product writing rules (structured)"));
  }

  const glossaryParts: string[] = [];
  if (product?.glossaryContent?.trim()) {
    glossaryParts.push("# Product glossary", product.glossaryContent.trim());
  }
  const structuredGlossary = formatGlossary(product?.glossary ?? [], auditedText);
  if (structuredGlossary) {
    glossaryParts.push(structuredGlossary);
  }

  return {
    proseBlock: proseParts.join("\n\n"),
    rulesBlock: ruleParts.join("\n\n"),
    glossaryBlock: glossaryParts.join("\n\n")
  };
}

/**
 * Inject guideline context for an audit item.
 * When `surface` is undefined, all rules from all surfaces are included (used by
 * the stub audit and batch contexts where per-item surface classification is unknown).
 */
export function injectGuidelineContext(
  snapshot: SessionGuidelineSnapshot,
  surface: Surface | undefined,
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
