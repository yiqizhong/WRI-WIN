import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { Guideline } from "@writer/contracts";

import { findImporter } from "./importers/index";
import type { ParseError } from "./importers/index";

export type GuidelineEntry =
  | { status: "ok"; guideline: Guideline; filePath: string; contentHash: string }
  | { status: "error"; error: ParseError; filePath: string };

export type GuidelineTreeResult = {
  entries: GuidelineEntry[];
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

async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name === "products") {
      const sub = await readdir(full, { withFileTypes: true });
      for (const s of sub) {
        if (s.isFile() && s.name.endsWith(".md")) files.push(join(full, s.name));
      }
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

export async function discoverGuidelines(): Promise<GuidelineTreeResult> {
  const dir = guidelinesDir();
  await scaffoldIfAbsent(dir);

  const files = await collectFiles(dir);
  const companyPath = join(dir, "company.md");
  const companyMissing = !files.includes(companyPath);

  const entries: GuidelineEntry[] = [];
  for (const filePath of files) {
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

  const conflictError = detectDuplicateIds(entries);

  return { entries, companyMissing, conflictError };
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
