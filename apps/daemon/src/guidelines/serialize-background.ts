import type { ProductBackground } from "@writer/contracts";

export function productBackgroundToMarkdown(bg: ProductBackground): string {
  if (bg.content.trim().length > 0) {
    return bg.content;
  }
  return bg.body ?? "";
}
