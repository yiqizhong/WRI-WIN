import type { Guideline, ProductPackage, Term } from "@writer/contracts";

import type { FileParseResult, GuidelineTreeResult, ProductPackageResult } from "./discovery";

export type ResolvedGuideline = Guideline & {
  _filePath: string;
  _contentHash: string;
  _prose?: string;
};

export type ResolvedProductPackage = ProductPackage & {
  _filePaths: { background: string; glossary?: string; writingGuide?: string };
  _contentHashes: Record<string, string>;
};

export type ResolvedTree = {
  companyBase: ResolvedGuideline | null;
  softwareWriting: ResolvedGuideline | null;
  companyGlossary: Term[];
  products: ResolvedProductPackage[];
  companyBaseMissing: boolean;
  softwareWritingMissing: boolean;
  companyGlossaryMissing: boolean;
  conflictError?: string;
  errors: GuidelineTreeResult["errors"];
};

function resolveGuideline(slot: FileParseResult<Guideline>): ResolvedGuideline | null {
  if (slot.status !== "ok") return null;
  return {
    ...slot.value,
    _filePath: slot.filePath,
    _contentHash: slot.contentHash,
    _prose: slot.value.body
  };
}

function resolveProduct(product: ProductPackageResult): ResolvedProductPackage | null {
  if (product.status !== "ok") return null;
  return {
    ...product.package,
    _filePaths: product.filePaths,
    _contentHashes: product.contentHashes
  };
}

export function buildResolvedTree(treeResult: GuidelineTreeResult): ResolvedTree {
  const companyGlossary =
    treeResult.companyGlossary?.status === "ok" ? treeResult.companyGlossary.value : [];

  return {
    companyBase: treeResult.companyBase ? resolveGuideline(treeResult.companyBase) : null,
    softwareWriting: treeResult.softwareWriting ? resolveGuideline(treeResult.softwareWriting) : null,
    companyGlossary,
    products: treeResult.products.map(resolveProduct).filter((p): p is ResolvedProductPackage => p !== null),
    companyBaseMissing: treeResult.companyBaseMissing,
    softwareWritingMissing: treeResult.softwareWritingMissing,
    companyGlossaryMissing: treeResult.companyGlossaryMissing,
    conflictError: treeResult.conflictError,
    errors: treeResult.errors
  };
}

/** Flat guideline list for v1 routes and snapshots until WRI-118. */
export function collectFlatGuidelines(tree: ResolvedTree): ResolvedGuideline[] {
  const list: ResolvedGuideline[] = [];
  if (tree.companyBase) list.push(tree.companyBase);
  if (tree.softwareWriting) list.push(tree.softwareWriting);
  for (const product of tree.products) {
    if (product.writingGuide) {
      list.push({
        ...product.writingGuide,
        productId: product.id,
        _filePath: product._filePaths.writingGuide ?? product._filePaths.background,
        _contentHash: product._contentHashes[product._filePaths.writingGuide ?? product._filePaths.background] ?? "",
        _prose: product.writingGuide.body
      });
    }
  }
  return list;
}

/** @deprecated alias */
export const buildInheritanceTree = buildResolvedTree;
