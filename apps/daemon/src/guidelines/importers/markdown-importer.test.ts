import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { MarkdownImporter } from "./markdown-importer";

const VALID_MD = `---
id: company
name: Company Guidelines
scope: company
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

Prose body text here.

## Rules

- id: use-active-voice
  do: Write in active voice
  surfaces:
    - body
    - title
  severity: should

## Glossary

- id: login-term
  term: Sign in
  status: active
  forbidden:
    - Login
    - Log in
  caseSensitive: false
`;

let dir: string;
const importer = new MarkdownImporter();

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "writer-guidelines-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("MarkdownImporter", () => {
  it("canHandle .md files only", () => {
    expect(importer.canHandle("company.md")).toBe(true);
    expect(importer.canHandle("company.pdf")).toBe(false);
    expect(importer.canHandle("notes.txt")).toBe(false);
  });

  it("parses a valid guideline file", async () => {
    const file = join(dir, "company.md");
    await writeFile(file, VALID_MD);

    const result = await importer.parse(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.guideline.id).toBe("company");
    expect(result.guideline.scope).toBe("company");
    expect(result.guideline.rules).toHaveLength(1);
    expect(result.guideline.rules[0].id).toBe("use-active-voice");
    expect(result.guideline.glossary).toHaveLength(1);
    expect(result.guideline.glossary[0].forbidden).toEqual(["Login", "Log in"]);
  });

  it("returns ParseError on broken YAML frontmatter", async () => {
    const file = join(dir, "broken.md");
    await writeFile(file, "---\nid: [unclosed\n---\n\nbody");

    const result = await importer.parse(file);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.file).toBe(file);
    expect(result.error.message).toMatch(/frontmatter/i);
  });

  it("returns ParseError on missing required field", async () => {
    const file = join(dir, "missing.md");
    const md = VALID_MD.replace("id: company\n", "");
    await writeFile(file, md);

    const result = await importer.parse(file);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/id/);
  });

  it("returns ParseError on broken Rules YAML", async () => {
    const file = join(dir, "bad-rules.md");
    const md = `---
id: company
name: Company
scope: company
schema: 1
version: "1.0.0"
updatedAt: "2024-01-01T00:00:00Z"
---

## Rules

- id: [unclosed
`;
    await writeFile(file, md);

    const result = await importer.parse(file);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Rules section/);
  });

  it("returns ParseError for missing file", async () => {
    const result = await importer.parse(join(dir, "nonexistent.md"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Cannot read file/);
  });
});
