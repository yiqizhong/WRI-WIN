import { basename } from "node:path";

import type {
  GuidelinesTree,
  GuidelineList,
  GuidelineListItem,
  GlossaryList,
  ProductPackage
} from "@writer/contracts";

import type { GuidelineTreeResult, ProductPackageResult } from "./discovery";
import { buildResolvedTree, collectFlatGuidelines } from "./inheritance";
import type { SlotDisplayNames } from "./slot-display-names";

function filenameFromPath(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const name = basename(filePath);
  return name.length > 0 ? name : undefined;
}

function productListItemFromPackage(pkg: ProductPackage) {
  const hasAnyFile =
    Boolean(pkg.background) ||
    Boolean(pkg.glossaryContent) ||
    Boolean(pkg.writingGuideContent) ||
    pkg.extraFiles.length > 0;
  return {
    id: pkg.id,
    name: pkg.name,
    hasBackground: Boolean(pkg.background),
    hasGlossary: Boolean(pkg.glossaryContent),
    hasWritingGuide: Boolean(pkg.writingGuideContent || pkg.writingGuide),
    extraFileCount: pkg.extraFiles.length,
    parseStatus: hasAnyFile ? ("ok" as const) : ("incomplete" as const)
  };
}

function productSlotDisplayName(
  display: SlotDisplayNames | undefined,
  productId: string,
  slot: "background" | "glossary" | "writingGuide",
  filePath: string | undefined,
  fallback: string
): string {
  const fromMeta =
    display?.products?.[productId]?.[slot] ??
    display?.products?.[productId.toLowerCase()]?.[slot];
  if (fromMeta) return fromMeta;
  return filenameFromPath(filePath) ?? fallback;
}

export function toGuidelinesTreeApi(
  tree: GuidelineTreeResult,
  display?: SlotDisplayNames
): GuidelinesTree {
  const companyBase = tree.companyBase;
  const softwareWriting = tree.softwareWriting;
  const companyBaseOk = companyBase != null && companyBase.status === "ok";
  const softwareWritingOk = softwareWriting != null && softwareWriting.status === "ok";

  return {
    companyBase: companyBaseOk ? companyBase.value : null,
    softwareWriting: softwareWritingOk ? softwareWriting.value : null,
    ...(companyBaseOk && display?.companyBase ? { companyBaseFilename: display.companyBase } : {}),
    ...(softwareWritingOk && display?.softwareWriting
      ? { softwareWritingFilename: display.softwareWriting }
      : {}),
    products: tree.products.map((p) => {
      if (p.status === "ok") {
        const item = productListItemFromPackage(p.package);
        return {
          ...item,
          ...(item.hasBackground
            ? {
                backgroundFilename: productSlotDisplayName(
                  display,
                  item.id,
                  "background",
                  p.filePaths.background,
                  "background.md"
                )
              }
            : {}),
          ...(item.hasGlossary
            ? {
                glossaryFilename: productSlotDisplayName(
                  display,
                  item.id,
                  "glossary",
                  p.filePaths.glossary,
                  "glossary.md"
                )
              }
            : {}),
          ...(item.hasWritingGuide
            ? {
                writingGuideFilename: productSlotDisplayName(
                  display,
                  item.id,
                  "writingGuide",
                  p.filePaths.writingGuide,
                  "writing-guide.md"
                )
              }
            : {})
        };
      }
      return {
        id: p.productId,
        name: p.productId,
        hasBackground: false,
        hasGlossary: false,
        hasWritingGuide: false,
        extraFileCount: 0,
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
    layer: g.layer ?? "company-base",
    ...(g.productId ? { productId: g.productId } : {}),
    version: g.version ?? "0",
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

/** @deprecated company glossary removed — returns product glossaries only */
export function toLegacyGlossaryList(tree: GuidelineTreeResult): GlossaryList {
  const glossaries: GlossaryList["glossaries"] = [];
  for (const p of tree.products) {
    if (p.status !== "ok" || !p.filePaths.glossary) continue;
    glossaries.push({
      id: `${p.package.id}-glossary`,
      name: `${p.package.name} glossary`,
      format: p.filePaths.glossary.endsWith(".csv") ? "csv" : "md",
      termCount: p.package.glossary.length,
      filePath: p.filePaths.glossary,
      parseStatus: "ok"
    });
  }
  return { glossaries };
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
