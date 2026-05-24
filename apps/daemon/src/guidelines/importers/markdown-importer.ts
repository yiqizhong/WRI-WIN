import { readFile } from "node:fs/promises";

import { guidelineSchema, type Guideline } from "@writer/contracts";
import matter from "gray-matter";
import yaml from "js-yaml";

import type { Importer, ParseError, ParseResult } from "./index";

function lineOf(content: string, searchStr: string): number | undefined {
  const idx = content.indexOf(searchStr);
  if (idx === -1) return undefined;
  return content.slice(0, idx).split("\n").length;
}

function extractSection(body: string, heading: string): { raw: string; startLine: number } | null {
  const headingRe = new RegExp(`^##\\s+${heading}\\s*$`, "m");
  const match = headingRe.exec(body);
  if (!match) return null;

  const start = match.index + match[0].length + 1;
  const nextHeading = /^##\s+/m.exec(body.slice(start));
  const raw = nextHeading
    ? body.slice(start, start + nextHeading.index).trim()
    : body.slice(start).trim();

  const startLine = body.slice(0, match.index).split("\n").length + 1;
  return { raw, startLine };
}

export class MarkdownImporter implements Importer {
  canHandle(filePath: string): boolean {
    return filePath.endsWith(".md");
  }

  async parse(filePath: string): Promise<ParseResult> {
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
      body = parsed.content;
    } catch (err) {
      return {
        ok: false,
        error: { file: filePath, line: 1, message: `YAML frontmatter parse error: ${String(err)}` }
      };
    }

    const rulesSection = extractSection(body, "Rules");
    const glossarySection = extractSection(body, "Glossary");

    let rules: unknown[] = [];
    if (rulesSection) {
      try {
        const parsed = yaml.load(rulesSection.raw);
        rules = Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        const line = rulesSection.startLine;
        return {
          ok: false,
          error: { file: filePath, line, message: `Rules section YAML error: ${String(err)}` }
        };
      }
    }

    let glossary: unknown[] = [];
    if (glossarySection) {
      try {
        const parsed = yaml.load(glossarySection.raw);
        glossary = Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        const line = glossarySection.startLine;
        return {
          ok: false,
          error: { file: filePath, line, message: `Glossary section YAML error: ${String(err)}` }
        };
      }
    }

    const proseBody = body.search(/^##\s+/m) === -1 ? body.trim() : body.slice(0, body.search(/^##\s+/m)).trim();

    const payload = { ...frontmatter, body: proseBody || undefined, rules, glossary };
    const result = guidelineSchema.safeParse(payload);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const fieldPath = firstIssue.path.join(".");
      const approxLine = fieldPath ? lineOf(raw, fieldPath) : undefined;
      return {
        ok: false,
        error: {
          file: filePath,
          line: approxLine,
          message: `Validation error at ${fieldPath || "root"}: ${firstIssue.message}`
        }
      };
    }

    return { ok: true, guideline: result.data as Guideline };
  }
}
