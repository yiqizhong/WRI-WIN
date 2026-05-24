import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { guidelinesDir } from "./discovery";

export type WriteOutcome = { ok: true; filePath: string } | { ok: false; code: "conflict" | "invalid_filename" | "io_error"; message: string };

function sanitizeFilename(name: string, extensions: string[]): string | null {
  const stripped = basename(name).trim();
  if (!stripped || stripped.startsWith(".")) return null;
  if (/[\/\\\0]/.test(stripped)) return null;
  const lower = stripped.toLowerCase();
  if (!extensions.some((ext) => lower.endsWith(ext))) {
    return stripped + extensions[0];
  }
  return stripped;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertInsideDir(targetPath: string, rootDir: string): boolean {
  const normalizedRoot = resolve(rootDir);
  const normalizedTarget = resolve(targetPath);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(normalizedRoot + "/");
}

export async function writeGuideline(input: {
  filename: string;
  content: string;
  scope: "company" | "product";
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  await mkdir(dir, { recursive: true });

  let target: string;
  if (input.scope === "company") {
    target = join(dir, "company.md");
  } else {
    const safe = sanitizeFilename(input.filename, [".md"]);
    if (!safe) return { ok: false, code: "invalid_filename", message: "Invalid filename." };
    await mkdir(join(dir, "products"), { recursive: true });
    target = join(dir, "products", safe);
  }

  if (!assertInsideDir(target, dir)) {
    return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
  }

  if (!input.overwrite && (await exists(target))) {
    return { ok: false, code: "conflict", message: `File already exists: ${target}` };
  }

  try {
    await writeFile(target, input.content, "utf8");
    return { ok: true, filePath: target };
  } catch (err) {
    return { ok: false, code: "io_error", message: String(err) };
  }
}

export async function writeGlossary(input: {
  filename: string;
  content: string;
  format: "csv" | "md";
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const glossaryDir = join(dir, "glossary");
  await mkdir(glossaryDir, { recursive: true });

  const safe = sanitizeFilename(input.filename, [`.${input.format}`]);
  if (!safe) return { ok: false, code: "invalid_filename", message: "Invalid filename." };

  const target = join(glossaryDir, safe);
  if (!assertInsideDir(target, dir)) {
    return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
  }

  if (!input.overwrite && (await exists(target))) {
    return { ok: false, code: "conflict", message: `File already exists: ${target}` };
  }

  try {
    await writeFile(target, input.content, "utf8");
    return { ok: true, filePath: target };
  } catch (err) {
    return { ok: false, code: "io_error", message: String(err) };
  }
}

export async function deleteGuideline(filePath: string): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  if (!assertInsideDir(filePath, dir)) {
    return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
  }
  if (filePath === join(dir, "company.md")) {
    return { ok: false, code: "invalid_filename", message: "Cannot delete company.md. Overwrite it instead." };
  }
  try {
    await unlink(filePath);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, code: "io_error", message: String(err) };
  }
}

export async function deleteGlossary(filePath: string): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const glossaryDir = join(dir, "glossary");
  if (!assertInsideDir(filePath, glossaryDir)) {
    return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
  }
  try {
    await unlink(filePath);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, code: "io_error", message: String(err) };
  }
}
