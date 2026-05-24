import type { Guideline, GuidelineSnapshot, ProductPackage, ThreeLayerGuidelineSnapshot } from "@writer/contracts";

import type { ResolvedProductPackage, ResolvedTree } from "./inheritance";

function stripGuideline(guideline: Guideline & { _filePath?: string; _contentHash?: string; _prose?: string }): Guideline {
  const { _filePath, _contentHash, _prose, ...rest } = guideline as Guideline & {
    _filePath?: string;
    _contentHash?: string;
    _prose?: string;
  };
  return rest;
}

function stripProductPackage(pkg: ResolvedProductPackage): ProductPackage {
  const { _filePaths, _contentHashes, ...rest } = pkg;
  return rest;
}

export function buildThreeLayerSnapshot(
  tree: ResolvedTree,
  activeProductId?: string | null
): ThreeLayerGuidelineSnapshot {
  const product =
    activeProductId != null && activeProductId !== ""
      ? tree.products.find((p) => p.id === activeProductId)
      : undefined;

  const contentHashes: Record<string, string> = {};
  if (tree.companyBase) {
    contentHashes[tree.companyBase._filePath] = tree.companyBase._contentHash;
  }
  if (tree.softwareWriting) {
    contentHashes[tree.softwareWriting._filePath] = tree.softwareWriting._contentHash;
  }
  if (product) {
    Object.assign(contentHashes, product._contentHashes);
  }

  return {
    companyBase: tree.companyBase ? stripGuideline(tree.companyBase) : null,
    softwareWriting: tree.softwareWriting ? stripGuideline(tree.softwareWriting) : null,
    companyGlossary: tree.companyGlossary,
    activeProductId: activeProductId ?? undefined,
    productPackage: product ? stripProductPackage(product) : undefined,
    contentHashes,
    capturedAt: new Date().toISOString()
  };
}

/** v1 single-guideline snapshot */
export function buildSnapshot(
  guideline: Guideline & { _filePath: string; _contentHash: string }
): GuidelineSnapshot {
  return {
    guidelineId: guideline.id,
    guideline: stripGuideline(guideline),
    contentHashes: { [guideline._filePath]: guideline._contentHash },
    capturedAt: new Date().toISOString()
  };
}
