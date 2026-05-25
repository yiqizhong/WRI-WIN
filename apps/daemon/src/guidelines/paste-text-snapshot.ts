import { createHash } from "node:crypto";

import type { PasteTextGuidelineLayerSnapshot, PasteTextGuidelineSnapshot } from "@writer/contracts";

import { productBackgroundToMarkdown } from "./serialize-background";
import type { ResolvedProductPackage, ResolvedTree } from "./inheritance";

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function layerFromGuideline(
  guideline: { id: string; _contentHash: string; _prose?: string; body?: string }
): PasteTextGuidelineLayerSnapshot | undefined {
  const content = (guideline._prose ?? guideline.body ?? "").trim();
  if (!content) {
    return undefined;
  }

  return {
    id: guideline.id,
    contentHash: guideline._contentHash,
    content
  };
}

function buildProductGuidelineContent(product: ResolvedProductPackage): string {
  const sections: string[] = [];

  if (product.background) {
    const background = productBackgroundToMarkdown(product.background).trim();
    if (background) {
      sections.push(`# Product background: ${product.background.name}`, background);
    }
  }

  if (product.glossaryContent?.trim()) {
    sections.push("# Product glossary", product.glossaryContent.trim());
  }

  if (product.writingGuideContent?.trim()) {
    sections.push("# Product writing guide", product.writingGuideContent.trim());
  } else if (product.writingGuide?.body?.trim()) {
    sections.push("# Product writing guide", product.writingGuide.body.trim());
  }

  return sections.join("\n\n");
}

export function buildPasteTextGuidelineSnapshot(
  tree: ResolvedTree,
  productId?: string
): PasteTextGuidelineSnapshot {
  const snapshot: PasteTextGuidelineSnapshot = {};

  if (tree.companyBase) {
    const layer = layerFromGuideline(tree.companyBase);
    if (layer) {
      snapshot.companyBase = layer;
    }
  }

  if (tree.softwareWriting) {
    const layer = layerFromGuideline(tree.softwareWriting);
    if (layer) {
      snapshot.softwareWriting = layer;
    }
  }

  if (productId) {
    const product = tree.products.find((item) => item.id === productId);
    if (!product) {
      throw new Error(`Unknown productId: ${productId}`);
    }

    const productContent = buildProductGuidelineContent(product).trim();
    if (productContent) {
      const hashes = Object.values(product._contentHashes).filter(Boolean);
      snapshot.productGuideline = {
        id: product.id,
        contentHash: hashes.length > 0 ? hashes.sort().join(":") : hashContent(productContent),
        content: productContent
      };
    }
  }

  return snapshot;
}
