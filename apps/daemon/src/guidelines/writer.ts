import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import type { GuidelineLayer } from "@writer/contracts";

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

export async function writeCompanyBase(input: { content: string; overwrite?: boolean }): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  await mkdir(dir, { recursive: true });
  const target = join(dir, "company-base.md");
  return writeFileAt(target, dir, input.content, input.overwrite);
}

export async function writeSoftwareWriting(input: { content: string; overwrite?: boolean }): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  await mkdir(dir, { recursive: true });
  const target = join(dir, "software-writing.md");
  return writeFileAt(target, dir, input.content, input.overwrite);
}

export async function writeCompanyGlossary(input: {
  content: string;
  format: "csv" | "md";
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  await mkdir(dir, { recursive: true });
  const target = join(dir, `company-glossary.${input.format}`);
  return writeFileAt(target, dir, input.content, input.overwrite);
}

export async function writeProductBackground(input: {
  productId: string;
  content: string;
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const productDir = join(dir, "products", input.productId);
  await mkdir(productDir, { recursive: true });
  const target = join(productDir, "background.md");
  return writeFileAt(target, dir, input.content, input.overwrite);
}

export async function writeProductGlossary(input: {
  productId: string;
  content: string;
  format: "csv" | "md";
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const productDir = join(dir, "products", input.productId);
  await mkdir(productDir, { recursive: true });
  const target = join(productDir, `glossary.${input.format}`);
  return writeFileAt(target, dir, input.content, input.overwrite);
}

export async function writeProductWritingGuide(input: {
  productId: string;
  content: string;
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const productDir = join(dir, "products", input.productId);
  await mkdir(productDir, { recursive: true });
  const target = join(productDir, "writing-guide.md");
  return writeFileAt(target, dir, input.content, input.overwrite);
}

async function writeFileAt(
  target: string,
  rootDir: string,
  content: string,
  overwrite?: boolean
): Promise<WriteOutcome> {
  if (!assertInsideDir(target, rootDir)) {
    return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
  }
  if (!overwrite && (await exists(target))) {
    return { ok: false, code: "conflict", message: `File already exists: ${target}` };
  }
  try {
    await writeFile(target, content, "utf8");
    return { ok: true, filePath: target };
  } catch (err) {
    return { ok: false, code: "io_error", message: String(err) };
  }
}

/** @deprecated v1 upload — maps company/product to 3-layer paths until desktop migrates (WRI-119) */
export async function writeGuideline(input: {
  filename: string;
  content: string;
  layer: GuidelineLayer;
  productId?: string;
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  if (input.layer === "company-base") {
    return writeCompanyBase({ content: input.content, overwrite: input.overwrite });
  }
  if (input.layer === "software-writing") {
    return writeSoftwareWriting({ content: input.content, overwrite: input.overwrite });
  }
  const productId = input.productId ?? sanitizeFilename(input.filename, [".md"])?.replace(/\.md$/, "");
  if (!productId) {
    return { ok: false, code: "invalid_filename", message: "Product id required for product-writing uploads." };
  }
  return writeProductWritingGuide({
    productId,
    content: input.content,
    overwrite: input.overwrite
  });
}

/** @deprecated v1 standalone glossary dir — use writeCompanyGlossary (WRI-114) */
export async function writeGlossary(input: {
  filename: string;
  content: string;
  format: "csv" | "md";
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  return writeCompanyGlossary({ content: input.content, format: input.format, overwrite: input.overwrite });
}

export async function deleteGuideline(filePath: string): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  if (!assertInsideDir(filePath, dir)) {
    return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
  }
  if (filePath === join(dir, "company-base.md")) {
    return {
      ok: false,
      code: "invalid_filename",
      message: "Cannot delete company-base.md. Overwrite it instead."
    };
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
  const companyGlossaryCsv = join(dir, "company-glossary.csv");
  const companyGlossaryMd = join(dir, "company-glossary.md");
  if (filePath === companyGlossaryCsv || filePath === companyGlossaryMd) {
    return {
      ok: false,
      code: "invalid_filename",
      message: "Cannot delete company glossary slot. Overwrite it instead."
    };
  }
  if (!assertInsideDir(filePath, dir)) {
    return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
  }
  try {
    await unlink(filePath);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, code: "io_error", message: String(err) };
  }
}
