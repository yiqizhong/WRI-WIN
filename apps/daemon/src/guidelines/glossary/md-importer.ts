import { termSchema, type Term } from "@writer/contracts";
import matter from "gray-matter";
import yaml from "js-yaml";

import type { ParseError } from "../importers/index";

export type GlossaryMdResult =
  | { ok: true; id?: string; name?: string; terms: Term[] }
  | { ok: false; error: ParseError };

function extractSection(body: string, heading: string): string | null {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, "m");
  const match = re.exec(body);
  if (!match) return null;
  const start = match.index + match[0].length + 1;
  const next = /^##\s+/m.exec(body.slice(start));
  return next ? body.slice(start, start + next.index).trim() : body.slice(start).trim();
}

export function parseStandaloneGlossaryMd(raw: string, filePath: string): GlossaryMdResult {
  let data: Record<string, unknown>;
  let body: string;
  try {
    const parsed = matter(raw);
    data = parsed.data as Record<string, unknown>;
    body = parsed.content;
  } catch (err) {
    return { ok: false, error: { file: filePath, line: 1, message: `Frontmatter error: ${String(err)}` } };
  }

  const glossaryRaw = extractSection(body, "Glossary");
  if (!glossaryRaw) {
    return {
      ok: false,
      error: { file: filePath, message: "Missing `## Glossary` section in standalone glossary file." }
    };
  }

  let rawTerms: unknown[];
  try {
    const parsed = yaml.load(glossaryRaw);
    rawTerms = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return { ok: false, error: { file: filePath, message: `Glossary YAML error: ${String(err)}` } };
  }

  const terms: Term[] = [];
  for (let i = 0; i < rawTerms.length; i++) {
    const result = termSchema.safeParse(rawTerms[i]);
    if (!result.success) {
      const issue = result.error.issues[0];
      return {
        ok: false,
        error: {
          file: filePath,
          message: `Glossary entry ${i + 1}: ${issue.path.join(".")} — ${issue.message}`
        }
      };
    }
    terms.push(result.data);
  }

  return {
    ok: true,
    id: typeof data.id === "string" ? data.id : undefined,
    name: typeof data.name === "string" ? data.name : undefined,
    terms
  };
}
