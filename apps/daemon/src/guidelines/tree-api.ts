import type {
  GuidelinesTree,
  GuidelineList,
  GuidelineListItem,
  GlossaryList,
  ProductPackage
} from "@writer/contracts";

import type { GuidelineTreeResult, ProductPackageResult } from "./discovery";
import { buildResolvedTree, collectFlatGuidelines } from "./inheritance";

export function toGuidelinesTreeApi(tree: GuidelineTreeResult): GuidelinesTree {
  return {
    companyBase: tree.companyBase?.status === "ok" ? tree.companyBase.value : null,
    softwareWriting: tree.softwareWriting?.status === "ok" ? tree.softwareWriting.value : null,
    companyGlossary: tree.companyGlossary?.status === "ok" ? tree.companyGlossary.value : [],
    products: tree.products.map((p) => {
      if (p.status === "ok") {
        return {
          id: p.package.id,
          name: p.package.name,
          hasBackground: true,
          hasGlossary: p.package.glossary.length > 0,
          hasWritingGuide: Boolean(p.package.writingGuide),
          parseStatus: "ok" as const
        };
      }
      return {
        id: p.productId,
        name: p.productId,
        hasBackground: false,
        hasGlossary: false,
        hasWritingGuide: false,
        parseStatus: "error" as const,
        parseError: p.error
      };
    }),
    companyBaseMissing: tree.companyBaseMissing,
    softwareWritingMissing: tree.softwareWritingMissing,
    conflictError: tree.conflictError
  };
}

/** v1 flat list for desktop until WRI-119. */
export function toLegacyGuidelineList(tree: GuidelineTreeResult): GuidelineList {
  const resolved = buildResolvedTree(tree);
  const guidelines: GuidelineListItem[] = collectFlatGuidelines(resolved).map((g) => ({
    id: g.id,
    layer: g.layer,
    ...(g.productId ? { productId: g.productId } : {}),
    version: g.version,
    ruleCount: g.rules.length,
    termCount: g.glossary.length,
    parseStatus: "ok" as const
  }));

  for (const slot of [tree.companyBase, tree.softwareWriting]) {
    if (slot?.status === "error") {
      guidelines.push({
        id: slot.filePath,
        layer: "company-base",
        version: "unknown",
        ruleCount: 0,
        termCount: 0,
        parseStatus: "error",
        parseError: slot.error
      });
    }
  }

  for (const p of tree.products) {
    if (p.status === "error") {
      guidelines.push({
        id: p.productId,
        layer: "product-writing",
        productId: p.productId,
        version: "unknown",
        ruleCount: 0,
        termCount: 0,
        parseStatus: "error",
        parseError: p.error
      });
    }
  }

  return {
    guidelines,
    companyMissing: tree.companyBaseMissing
  };
}

export function toLegacyGlossaryList(tree: GuidelineTreeResult): GlossaryList {
  if (!tree.companyGlossary) {
    return { glossaries: [] };
  }
  if (tree.companyGlossary.status === "error") {
    return {
      glossaries: [
        {
          id: "company-glossary",
          name: "Company Glossary",
          format: tree.companyGlossary.filePath.endsWith(".csv") ? "csv" : "md",
          termCount: 0,
          filePath: tree.companyGlossary.filePath,
          parseStatus: "error",
          parseError: tree.companyGlossary.error
        }
      ]
    };
  }
  return {
    glossaries: [
      {
        id: "company-glossary",
        name: "Company Glossary",
        format: tree.companyGlossary.filePath.endsWith(".csv") ? "csv" : "md",
        termCount: tree.companyGlossary.value.length,
        filePath: tree.companyGlossary.filePath,
        parseStatus: "ok"
      }
    ]
  };
}

export function listProductPackages(tree: GuidelineTreeResult): ProductPackage[] {
  return tree.products
    .filter((p): p is Extract<ProductPackageResult, { status: "ok" }> => p.status === "ok")
    .map((p) => p.package);
}

export function findProductPackage(tree: GuidelineTreeResult, productId: string): ProductPackage | null {
  const entry = tree.products.find((p) => p.status === "ok" && p.package.id === productId);
  return entry?.status === "ok" ? entry.package : null;
}

export function findGuidelineFilePath(tree: GuidelineTreeResult, id: string): string | null {
  if (tree.companyBase?.status === "ok" && tree.companyBase.value.id === id) {
    return tree.companyBase.filePath;
  }
  if (tree.softwareWriting?.status === "ok" && tree.softwareWriting.value.id === id) {
    return tree.softwareWriting.filePath;
  }
  for (const p of tree.products) {
    if (p.status === "ok" && p.package.writingGuide?.id === id) {
      return p.filePaths.writingGuide ?? null;
    }
  }
  return null;
}
