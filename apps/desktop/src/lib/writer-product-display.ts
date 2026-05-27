/** User-facing product title from folder id (e.g. `ddpm` → `DDPM`), not background frontmatter `name`. */
export function formatProductDisplayName(productId: string): string {
  return productId.toLocaleUpperCase("en-US");
}
