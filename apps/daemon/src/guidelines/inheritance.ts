import type { Guideline, Rule, Term } from "@writer/contracts";

import type { GuidelineEntry, GuidelineTreeResult } from "./discovery";

export type ResolvedGuideline = Guideline & {
  _filePath: string;
  _contentHash: string;
};

export type ResolvedTree = {
  company: ResolvedGuideline | null;
  products: ResolvedGuideline[];
  companyMissing: boolean;
  conflictError?: string;
};

function markInherited(rules: Rule[], fromId: string): Rule[] {
  return rules.map((r) => ({ ...r, inheritedFrom: fromId }));
}

function buildProductView(product: ResolvedGuideline, company: ResolvedGuideline): ResolvedGuideline {
  const ownIds = new Set(product.rules.map((r) => r.id));
  const inheritedRules: Rule[] = markInherited(
    company.rules.filter((r) => !ownIds.has(r.id)),
    company.id
  );

  const ownTermIds = new Set(product.glossary.map((t) => t.id));
  const inheritedTerms: Term[] = company.glossary
    .filter((t) => !ownTermIds.has(t.id))
    .map((t) => ({ ...t }));

  return {
    ...product,
    rules: [...inheritedRules, ...product.rules],
    glossary: [...inheritedTerms, ...product.glossary]
  };
}

function toResolved(entry: Extract<GuidelineEntry, { status: "ok" }>): ResolvedGuideline {
  return { ...entry.guideline, _filePath: entry.filePath, _contentHash: entry.contentHash };
}

export function buildInheritanceTree(treeResult: GuidelineTreeResult): ResolvedTree {
  const okEntries = treeResult.entries.filter(
    (e): e is Extract<GuidelineEntry, { status: "ok" }> => e.status === "ok"
  );

  const companyEntry = okEntries.find(
    (e) => e.guideline.layer === "company-base" || e.guideline.layer === "software-writing"
  );
  const productEntries = okEntries.filter((e) => e.guideline.layer === "product-writing");

  const company = companyEntry ? toResolved(companyEntry) : null;
  const products = productEntries.map((e) => {
    const resolved = toResolved(e);
    return company ? buildProductView(resolved, company) : resolved;
  });

  return {
    company,
    products,
    companyMissing: treeResult.companyMissing,
    conflictError: treeResult.conflictError
  };
}
