import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import type { Guideline, Term } from "@writer/contracts";

import { parseGlossaryCsv } from "./glossary/csv-importer";
import { parseStandaloneGlossaryMd } from "./glossary/md-importer";
import { findImporter } from "./importers/index";
import type { ParseError } from "./importers/index";

export type GuidelineEntry =
  | { status: "ok"; guideline: Guideline; filePath: string; contentHash: string }
  | { status: "error"; error: ParseError; filePath: string };

export type GlossaryEntry =
  | {
      status: "ok";
      id: string;
      name: string;
      format: "csv" | "md";
      terms: Term[];
      filePath: string;
      contentHash: string;
      updatedAt: string;
    }
  | { status: "error"; error: ParseError; filePath: string; format: "csv" | "md" };

export type GuidelineTreeResult = {
  entries: GuidelineEntry[];
  glossaries: GlossaryEntry[];
  companyMissing: boolean;
  conflictError?: string;
};

const STARTER_COMPANY_MD = `---
id: company
name: Company Guidelines
scope: company
schema: 1
version: "1.0.0"
updatedAt: "${new Date().toISOString()}"
---

This file defines your organization's UX writing standards. Edit it in any text editor.
The daemon watches this file and reloads automatically on save.

## Rules

# Each rule needs a unique kebab-case id, a "do" instruction, one or more surfaces,
# and a severity (must | should | may).
- id: use-active-voice
  do: Write in active voice to make actions clear and direct.
  dont: Avoid passive constructions like "the form was submitted."
  reason: Active voice reduces cognitive load and matches users' mental models.
  surfaces:
    - body
    - title
  severity: should

## Glossary

# Each term needs a unique id, a preferred spelling in "term",
# and a list of forbidden alternatives in "forbidden".
- id: sign-in
  term: Sign in
  status: active
  forbidden:
    - Login
    - Log in
  caseSensitive: false
  reason: Consistent with platform conventions; lowercase two words.
`;

export function guidelinesDir(): string {
  return join(homedir(), ".writer", "guidelines");
}

async function scaffoldIfAbsent(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const companyPath = join(dir, "company.md");
  try {
    await readFile(companyPath);
  } catch {
    await writeFile(companyPath, STARTER_COMPANY_MD, "utf8");
  }
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

async function collectFiles(dir: string): Promise<{ guidelines: string[]; glossaries: string[] }> {
  const guidelines: string[] = [];
  const glossaries: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name === "products") {
      const sub = await readdir(full, { withFileTypes: true });
      for (const s of sub) {
        if (s.isFile() && s.name.endsWith(".md")) guidelines.push(join(full, s.name));
      }
    } else if (entry.isDirectory() && entry.name === "glossary") {
      const sub = await readdir(full, { withFileTypes: true });
      for (const s of sub) {
        if (s.isFile() && (s.name.endsWith(".csv") || s.name.endsWith(".md"))) {
          glossaries.push(join(full, s.name));
        }
      }
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      guidelines.push(full);
    }
  }
  return { guidelines, glossaries };
}

async function parseGlossaryFile(filePath: string): Promise<GlossaryEntry> {
  const format: "csv" | "md" = filePath.endsWith(".csv") ? "csv" : "md";
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    return {
      status: "error",
      format,
      filePath,
      error: { file: filePath, message: `Cannot read file: ${String(err)}` }
    };
  }

  const idFromName = basename(filePath).replace(/\.(csv|md)$/, "");
  const hash = contentHash(raw);
  const updatedAt = new Date().toISOString();

  if (format === "csv") {
    const parsed = parseGlossaryCsv(raw);
    if (!parsed.ok) {
      return {
        status: "error",
        format,
        filePath,
        error: { file: filePath, line: parsed.line || undefined, message: parsed.message }
      };
    }
    return {
      status: "ok",
      id: idFromName,
      name: idFromName,
      format,
      terms: parsed.terms,
      filePath,
      contentHash: hash,
      updatedAt
    };
  }

  const parsed = parseStandaloneGlossaryMd(raw, filePath);
  if (!parsed.ok) {
    return { status: "error", format, filePath, error: parsed.error };
  }
  return {
    status: "ok",
    id: parsed.id || idFromName,
    name: parsed.name || idFromName,
    format,
    terms: parsed.terms,
    filePath,
    contentHash: hash,
    updatedAt
  };
}

export async function discoverGuidelines(): Promise<GuidelineTreeResult> {
  const dir = guidelinesDir();
  await scaffoldIfAbsent(dir);

  const { guidelines: guidelineFiles, glossaries: glossaryFiles } = await collectFiles(dir);
  const companyPath = join(dir, "company.md");
  const companyMissing = !guidelineFiles.includes(companyPath);

  const entries: GuidelineEntry[] = [];
  for (const filePath of guidelineFiles) {
    const importer = findImporter(filePath);
    if (!importer) continue;

    const result = await importer.parse(filePath);
    if (result.ok) {
      let raw = "";
      try {
        raw = await readFile(filePath, "utf8");
      } catch {
        // hash stays empty string on read failure
      }
      entries.push({
        status: "ok",
        guideline: result.guideline,
        filePath,
        contentHash: contentHash(raw)
      });
    } else {
      entries.push({ status: "error", error: result.error, filePath });
    }
  }

  const glossaries: GlossaryEntry[] = [];
  for (const filePath of glossaryFiles) {
    glossaries.push(await parseGlossaryFile(filePath));
  }

  const conflictError = detectDuplicateIds(entries);

  return { entries, glossaries, companyMissing, conflictError };
}

function detectDuplicateIds(entries: GuidelineEntry[]): string | undefined {
  const ruleIds = new Map<string, string>();
  const termIds = new Map<string, string>();

  for (const entry of entries) {
    if (entry.status !== "ok") continue;
    const { guideline, filePath } = entry;

    for (const rule of guideline.rules) {
      const existing = ruleIds.get(rule.id);
      if (existing) {
        return `Duplicate rule id "${rule.id}" found in ${existing} and ${filePath}`;
      }
      ruleIds.set(rule.id, filePath);
    }

    for (const term of guideline.glossary) {
      const existing = termIds.get(term.id);
      if (existing) {
        return `Duplicate term id "${term.id}" found in ${existing} and ${filePath}`;
      }
      termIds.set(term.id, filePath);
    }
  }

  return undefined;
}
