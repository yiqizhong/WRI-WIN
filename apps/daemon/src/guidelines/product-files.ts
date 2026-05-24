import { basename } from "node:path";

export type ProductSlotKind = "background" | "glossary" | "writing-guide" | "extra";

export function classifyProductFilename(filename: string): {
  kind: ProductSlotKind;
  format?: "csv" | "md";
  targetName?: string;
} {
  const base = basename(filename).toLowerCase();
  if (base === "background.md") return { kind: "background", targetName: "background.md" };
  if (base === "writing-guide.md") return { kind: "writing-guide", targetName: "writing-guide.md" };
  if (base === "glossary.csv") return { kind: "glossary", format: "csv", targetName: "glossary.csv" };
  if (base === "glossary.md") return { kind: "glossary", format: "md", targetName: "glossary.md" };
  if (base.includes("glossary") && base.endsWith(".csv")) {
    return { kind: "glossary", format: "csv", targetName: "glossary.csv" };
  }
  if (base.includes("glossary") && base.endsWith(".md")) {
    return { kind: "glossary", format: "md", targetName: "glossary.md" };
  }
  if (base.includes("writing") && base.endsWith(".md")) {
    return { kind: "writing-guide", targetName: "writing-guide.md" };
  }
  if (base.endsWith(".md") && (base.includes("background") || base.includes("context"))) {
    return { kind: "background", targetName: "background.md" };
  }
  return { kind: "extra", targetName: basename(filename) };
}
