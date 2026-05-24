import { readFile } from "node:fs/promises";

import type { ProductBackground } from "@writer/contracts";
import matter from "gray-matter";

import type { ParseError } from "../importers/index";

export type BackgroundParseResult =
  | { ok: true; background: ProductBackground }
  | { ok: false; error: ParseError };

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

  let id = productId;
  let name = productId;
  let audience: string | undefined;
  let environment: string | undefined;
  let purpose: string | undefined;
  let body: string | undefined;

  try {
    const parsed = matter(raw);
    const fm = parsed.data as Record<string, unknown>;
    if (typeof fm.id === "string" && fm.id.trim()) id = fm.id.trim();
    if (typeof fm.name === "string" && fm.name.trim()) name = fm.name.trim();
    if (typeof fm.audience === "string") audience = fm.audience;
    if (typeof fm.environment === "string") environment = fm.environment;
    if (typeof fm.purpose === "string") purpose = fm.purpose;
    body = parsed.content.trim() || undefined;
  } catch {
    body = raw.trim() || undefined;
  }

  return {
    ok: true,
    background: {
      id,
      name,
      content: raw,
      body,
      audience,
      environment,
      purpose
    }
  };
}
