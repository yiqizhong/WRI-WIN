/** Matches Figma Audit product picker when no product is selected. */
export const GENERAL_PURPOSE_PRODUCT_LABEL = "General purpose";

/** User-facing product title from folder id (e.g. `ddpm` → `DDPM`), not background frontmatter `name`. */
export function formatProductDisplayName(productId: string): string {
  return productId.toLocaleUpperCase("en-US");
}

/** Audit report subheader: `Product · Feature` (or `General purpose · Feature`). */
export function formatAuditDetailPageTitle(
  session: { productId?: string; featureName?: string } | null | undefined
): string {
  if (!session) {
    return "Audit";
  }

  const feature = session.featureName?.trim() || "Audit";
  const product = session.productId
    ? formatProductDisplayName(session.productId)
    : GENERAL_PURPOSE_PRODUCT_LABEL;

  return `${product} · ${feature}`;
}
