import { readFile } from "node:fs/promises";

import { productBackgroundSchema, type ProductBackground } from "@writer/contracts";
import matter from "gray-matter";

import type { ParseError } from "../importers/index";

export type BackgroundParseResult =
  | { ok: true; background: ProductBackground }
  | { ok: false; error: ParseError };

function lineOf(content: string, searchStr: string): number | undefined {
  const idx = content.indexOf(searchStr);
  if (idx === -1) return undefined;
  return content.slice(0, idx).split("\n").length;
}

export async function parseProductBackgroundFile(
  filePath: string,
  productId: string
): Promise<BackgroundParseResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    return {
      ok: false,
      error: { file: filePath, message: `Cannot read file: ${String(err)}` }
    };
  }

  let frontmatter: Record<string, unknown>;
  let body: string;
  try {
    const parsed = matter(raw);
    frontmatter = parsed.data as Record<string, unknown>;
    body = parsed.content.trim();
  } catch (err) {
    return {
      ok: false,
      error: { file: filePath, line: 1, message: `YAML frontmatter parse error: ${String(err)}` }
    };
  }

  const payload = {
    ...frontmatter,
    id: typeof frontmatter.id === "string" ? frontmatter.id : productId,
    body
  };

  const result = productBackgroundSchema.safeParse(payload);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const fieldPath = firstIssue.path.join(".");
    return {
      ok: false,
      error: {
        file: filePath,
        line: fieldPath ? lineOf(raw, fieldPath) : undefined,
        message: `Validation error at ${fieldPath || "root"}: ${firstIssue.message}`
      }
    };
  }

  return { ok: true, background: result.data };
}
