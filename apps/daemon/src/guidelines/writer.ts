import { access, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import type { GuidelineLayer } from "@writer/contracts";

import { guidelinesDir } from "./discovery";
import { classifyProductFilename } from "./product-files";

export type WriteOutcome = { ok: true; filePath: string } | { ok: false; code: "conflict" | "invalid_filename" | "io_error"; message: string };

const PRODUCT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function sanitizeProductId(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === "." || trimmed === "..") return null;
  if (trimmed.includes("..") || /[\/\\]/.test(trimmed)) return null;
  const normalized = trimmed
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!normalized || !PRODUCT_ID_RE.test(normalized)) return null;
  return normalized;
}

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

function productDir(rootDir: string, productId: string): string | null {
  const id = sanitizeProductId(productId);
  if (!id) return null;
  const dir = join(rootDir, "products", id);
  return assertInsideDir(dir, rootDir) ? dir : null;
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
  const other = join(dir, `company-glossary.${input.format === "csv" ? "md" : "csv"}`);
  const result = await writeFileAt(target, dir, input.content, input.overwrite);
  if (result.ok && (await exists(other))) {
    try {
      await unlink(other);
    } catch {
      // non-fatal if alternate format cannot be removed
    }
  }
  return result;
}

export async function writeProductExtraFile(input: {
  productId: string;
  filename: string;
  content: string;
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const dirPath = productDir(dir, input.productId);
  if (!dirPath) {
    return { ok: false, code: "invalid_filename", message: "Invalid product id." };
  }
  const safeName = sanitizeFilename(input.filename, [""]);
  if (!safeName) {
    return { ok: false, code: "invalid_filename", message: "Invalid filename." };
  }
  await mkdir(dirPath, { recursive: true });
  const target = join(dirPath, safeName);
  return writeFileAt(target, dir, input.content, input.overwrite ?? true);
}

async function writeClassifiedProductFile(
  productId: string,
  filename: string,
  content: string
): Promise<WriteOutcome> {
  const slot = classifyProductFilename(filename);
  if (slot.kind === "background") {
    return writeProductBackground({ productId, content, overwrite: true });
  }
  if (slot.kind === "glossary") {
    return writeProductGlossary({
      productId,
      content,
      format: slot.format ?? (filename.endsWith(".csv") ? "csv" : "md"),
      overwrite: true
    });
  }
  if (slot.kind === "writing-guide") {
    return writeProductWritingGuide({ productId, content, overwrite: true });
  }
  return writeProductExtraFile({ productId, filename: slot.targetName ?? filename, content, overwrite: true });
}

export async function createProduct(input: {
  productId: string;
  backgroundContent?: string;
  files?: Array<{ filename: string; content: string }>;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const dirPath = productDir(dir, input.productId);
  if (!dirPath) {
    return { ok: false, code: "invalid_filename", message: "Invalid product id." };
  }
  if (await exists(dirPath)) {
    return { ok: false, code: "conflict", message: `Product already exists: ${dirPath}` };
  }
  await mkdir(dirPath, { recursive: true });

  if (input.backgroundContent) {
    const bg = await writeProductBackground({
      productId: basename(dirPath),
      content: input.backgroundContent,
      overwrite: true
    });
    if (!bg.ok) return bg;
  }

  for (const file of input.files ?? []) {
    const result = await writeClassifiedProductFile(basename(dirPath), file.filename, file.content);
    if (!result.ok) return result;
  }

  return { ok: true, filePath: dirPath };
}

export async function writeProductBackground(input: {
  productId: string;
  content: string;
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const dirPath = productDir(dir, input.productId);
  if (!dirPath) {
    return { ok: false, code: "invalid_filename", message: "Invalid product id." };
  }
  await mkdir(dirPath, { recursive: true });
  const target = join(dirPath, "background.md");
  return writeFileAt(target, dir, input.content, input.overwrite);
}

export async function writeProductGlossary(input: {
  productId: string;
  content: string;
  format: "csv" | "md";
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const dirPath = productDir(dir, input.productId);
  if (!dirPath) {
    return { ok: false, code: "invalid_filename", message: "Invalid product id." };
  }
  await mkdir(dirPath, { recursive: true });
  const target = join(dirPath, `glossary.${input.format}`);
  const other = join(dirPath, `glossary.${input.format === "csv" ? "md" : "csv"}`);
  const result = await writeFileAt(target, dir, input.content, input.overwrite);
  if (result.ok && (await exists(other))) {
    try {
      await unlink(other);
    } catch {
      // ignore
    }
  }
  return result;
}

export async function writeProductWritingGuide(input: {
  productId: string;
  content: string;
  overwrite?: boolean;
}): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const dirPath = productDir(dir, input.productId);
  if (!dirPath) {
    return { ok: false, code: "invalid_filename", message: "Invalid product id." };
  }
  await mkdir(dirPath, { recursive: true });
  const target = join(dirPath, "writing-guide.md");
  return writeFileAt(target, dir, input.content, input.overwrite);
}

export async function deleteProduct(productId: string): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const dirPath = productDir(dir, productId);
  if (!dirPath) {
    return { ok: false, code: "invalid_filename", message: "Invalid product id." };
  }
  if (!(await exists(dirPath))) {
    return { ok: false, code: "invalid_filename", message: "Product not found." };
  }
  try {
    await rm(dirPath, { recursive: true, force: true });
    return { ok: true, filePath: dirPath };
  } catch (err) {
    return { ok: false, code: "io_error", message: String(err) };
  }
}

export async function deleteProductFile(
  productId: string,
  kind: "background" | "glossary" | "writing-guide"
): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const dirPath = productDir(dir, productId);
  if (!dirPath) {
    return { ok: false, code: "invalid_filename", message: "Invalid product id." };
  }

  const candidates =
    kind === "glossary"
      ? [join(dirPath, "glossary.csv"), join(dirPath, "glossary.md")]
      : kind === "background"
        ? [join(dirPath, "background.md")]
        : [join(dirPath, "writing-guide.md")];

  let removed: string | null = null;
  for (const path of candidates) {
    if (!(await exists(path))) continue;
    if (!assertInsideDir(path, dir)) {
      return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
    }
    try {
      await unlink(path);
      removed = path;
    } catch (err) {
      return { ok: false, code: "io_error", message: String(err) };
    }
  }

  if (!removed) {
    return { ok: false, code: "invalid_filename", message: `No ${kind} file found for product.` };
  }
  return { ok: true, filePath: removed };
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
  const productId = input.productId ?? sanitizeProductId(input.filename.replace(/\.md$/i, ""));
  if (!productId) {
    return { ok: false, code: "invalid_filename", message: "Product id required for product-writing uploads." };
  }
  return writeProductWritingGuide({
    productId,
    content: input.content,
    overwrite: input.overwrite
  });
}

/** @deprecated v1 standalone glossary dir — use writeCompanyGlossary */
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
  if (filePath === join(dir, "software-writing.md")) {
    return {
      ok: false,
      code: "invalid_filename",
      message: "Cannot delete software-writing.md. Overwrite it instead."
    };
  }
  try {
    await unlink(filePath);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, code: "io_error", message: String(err) };
  }
}

export async function deleteCompanyBase(): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const target = join(dir, "company-base.md");
  if (!(await exists(target))) {
    return { ok: false, code: "invalid_filename", message: "Company base not found." };
  }
  if (!assertInsideDir(target, dir)) {
    return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
  }
  try {
    await unlink(target);
    return { ok: true, filePath: target };
  } catch (err) {
    return { ok: false, code: "io_error", message: String(err) };
  }
}

export async function deleteSoftwareWriting(): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  const target = join(dir, "software-writing.md");
  if (!(await exists(target))) {
    return { ok: false, code: "invalid_filename", message: "Software writing not found." };
  }
  if (!assertInsideDir(target, dir)) {
    return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
  }
  try {
    await unlink(target);
    return { ok: true, filePath: target };
  } catch (err) {
    return { ok: false, code: "io_error", message: String(err) };
  }
}

export async function deleteCompanyGlossary(): Promise<WriteOutcome> {
  const dir = guidelinesDir();
  let removed: string | null = null;
  for (const ext of ["csv", "md"] as const) {
    const target = join(dir, `company-glossary.${ext}`);
    if (!(await exists(target))) continue;
    if (!assertInsideDir(target, dir)) {
      return { ok: false, code: "invalid_filename", message: "Path traversal blocked." };
    }
    try {
      await unlink(target);
      removed = target;
    } catch (err) {
      return { ok: false, code: "io_error", message: String(err) };
    }
  }
  if (!removed) {
    return { ok: false, code: "invalid_filename", message: "Company glossary not found." };
  }
  return { ok: true, filePath: removed };
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
