import type { ProductBackground } from "@writer/contracts";

export function productBackgroundToMarkdown(bg: ProductBackground): string {
  return `---
id: ${bg.id}
name: ${JSON.stringify(bg.name)}
audience: ${JSON.stringify(bg.audience)}
environment: ${JSON.stringify(bg.environment)}
purpose: ${JSON.stringify(bg.purpose)}
schema: ${bg.schema}
version: ${JSON.stringify(bg.version)}
updatedAt: ${JSON.stringify(bg.updatedAt)}
---

${bg.body}
`;
}
