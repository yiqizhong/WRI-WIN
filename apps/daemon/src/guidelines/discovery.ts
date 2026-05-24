import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { Guideline, ProductPackage, Term } from "@writer/contracts";

import { parseProductBackgroundFile } from "./glossary/background-importer";
import { parseGlossaryCsv } from "./glossary/csv-importer";
import { parseStandaloneGlossaryMd } from "./glossary/md-importer";
import { findImporter } from "./importers/index";
import type { ParseError } from "./importers/index";

export type FileParseResult<T> =
  | { status: "ok"; value: T; filePath: string; contentHash: string }
  | { status: "error"; error: ParseError; filePath: string };

export type ProductPackageResult =
  | {
      status: "ok";
      package: ProductPackage;
      filePaths: { background: string; glossary?: string; writingGuide?: string };
      contentHashes: Record<string, string>;
    }
  | { status: "error"; productId: string; error: ParseError; filePath: string };

export type GuidelineTreeResult = {
  companyBase: FileParseResult<Guideline> | null;
  softwareWriting: FileParseResult<Guideline> | null;
  companyGlossary: FileParseResult<Term[]> | null;
  products: ProductPackageResult[];
  errors: ParseError[];
  companyBaseMissing: boolean;
  softwareWritingMissing: boolean;
  companyGlossaryMissing: boolean;
  conflictError?: string;
};

export function guidelinesDir(): string {
  return join(homedir(), ".writer", "guidelines");
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** First-run: empty `guidelines/` + `products/` only (no sample content). */
export async function scaffoldIfAbsent(dir: string): Promise<void> {
  await mkdir(join(dir, "products"), { recursive: true });
}

async function readRaw(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function parseGuidelineFile(filePath: string): Promise<FileParseResult<Guideline>> {
  const importer = findImporter(filePath);
  if (!importer) {
    return {
      status: "error",
      filePath,
      error: { file: filePath, message: "No importer for file type." }
    };
  }

  const result = await importer.parse(filePath);
  if (!result.ok) {
    return { status: "error", filePath, error: result.error };
  }

  const raw = (await readRaw(filePath)) ?? "";
  return {
    status: "ok",
    value: result.guideline,
    filePath,
    contentHash: contentHash(raw)
  };
}

async function parseCompanyGlossaryFile(
  filePath: string,
  format: "csv" | "md"
): Promise<FileParseResult<Term[]>> {
  const raw = await readRaw(filePath);
  if (raw === null) {
    return {
      status: "error",
      filePath,
      error: { file: filePath, message: "Cannot read file." }
    };
  }

  if (format === "csv") {
    const parsed = parseGlossaryCsv(raw);
    if (!parsed.ok) {
      return {
        status: "error",
        filePath,
        error: { file: filePath, line: parsed.line || undefined, message: parsed.message }
      };
    }
    return { status: "ok", value: parsed.terms, filePath, contentHash: contentHash(raw) };
  }

  const parsed = parseStandaloneGlossaryMd(raw, filePath);
  if (!parsed.ok) {
    return { status: "error", filePath, error: parsed.error };
  }
  return { status: "ok", value: parsed.terms, filePath, contentHash: contentHash(raw) };
}

async function parseProductGlossary(
  filePath: string,
  format: "csv" | "md"
): Promise<Term[] | ParseError> {
  const raw = await readRaw(filePath);
  if (raw === null) {
    return { file: filePath, message: "Cannot read file." };
  }

  if (format === "csv") {
    const parsed = parseGlossaryCsv(raw);
    if (!parsed.ok) {
      return { file: filePath, line: parsed.line || undefined, message: parsed.message };
    }
    return parsed.terms;
  }

  const parsed = parseStandaloneGlossaryMd(raw, filePath);
  if (!parsed.ok) return parsed.error;
  return parsed.terms;
}

async function discoverProductPackage(
  productDir: string,
  productId: string
): Promise<ProductPackageResult | null> {
  const backgroundPath = join(productDir, "background.md");
  if (!(await fileExists(backgroundPath))) {
    return null;
  }

  const bgResult = await parseProductBackgroundFile(backgroundPath, productId);
  if (!bgResult.ok) {
    return { status: "error", productId, error: bgResult.error, filePath: backgroundPath };
  }

  const contentHashes: Record<string, string> = {};
  const rawBg = await readRaw(backgroundPath);
  if (rawBg !== null) contentHashes[backgroundPath] = contentHash(rawBg);

  let glossary: Term[] = [];
  let glossaryPath: string | undefined;
  const glossaryCsv = join(productDir, "glossary.csv");
  const glossaryMd = join(productDir, "glossary.md");
  if (await fileExists(glossaryCsv)) {
    glossaryPath = glossaryCsv;
    const terms = await parseProductGlossary(glossaryCsv, "csv");
    if ("message" in terms) {
      return { status: "error", productId, error: terms, filePath: glossaryCsv };
    }
    glossary = terms;
    const raw = await readRaw(glossaryCsv);
    if (raw !== null) contentHashes[glossaryCsv] = contentHash(raw);
  } else if (await fileExists(glossaryMd)) {
    glossaryPath = glossaryMd;
    const terms = await parseProductGlossary(glossaryMd, "md");
    if ("message" in terms) {
      return { status: "error", productId, error: terms, filePath: glossaryMd };
    }
    glossary = terms;
    const raw = await readRaw(glossaryMd);
    if (raw !== null) contentHashes[glossaryMd] = contentHash(raw);
  }

  let writingGuide: Guideline | undefined;
  const writingGuidePath = join(productDir, "writing-guide.md");
  if (await fileExists(writingGuidePath)) {
    const wg = await parseGuidelineFile(writingGuidePath);
    if (wg.status === "error") {
      return { status: "error", productId, error: wg.error, filePath: writingGuidePath };
    }
    writingGuide = wg.value;
    contentHashes[writingGuidePath] = wg.contentHash;
  }

  const pkg: ProductPackage = {
    id: productId,
    name: bgResult.background.name,
    background: bgResult.background,
    glossary,
    writingGuide
  };

  return {
    status: "ok",
    package: pkg,
    filePaths: { background: backgroundPath, glossary: glossaryPath, writingGuide: writingGuide ? writingGuidePath : undefined },
    contentHashes
  };
}

function detectDuplicateIds(tree: GuidelineTreeResult): string | undefined {
  const ruleIds = new Map<string, string>();
  const termIds = new Map<string, string>();

  const guidelineSlots = [tree.companyBase, tree.softwareWriting];
  for (const slot of guidelineSlots) {
    if (!slot || slot.status !== "ok") continue;
    const { value: guideline, filePath } = slot;
    for (const rule of guideline.rules) {
      const existing = ruleIds.get(rule.id);
      if (existing) return `Duplicate rule id "${rule.id}" found in ${existing} and ${filePath}`;
      ruleIds.set(rule.id, filePath);
    }
    for (const term of guideline.glossary) {
      const existing = termIds.get(term.id);
      if (existing) return `Duplicate term id "${term.id}" found in ${existing} and ${filePath}`;
      termIds.set(term.id, filePath);
    }
  }

  if (tree.companyGlossary?.status === "ok") {
    for (const term of tree.companyGlossary.value) {
      const existing = termIds.get(term.id);
      const filePath = tree.companyGlossary.filePath;
      if (existing) return `Duplicate term id "${term.id}" found in ${existing} and ${filePath}`;
      termIds.set(term.id, filePath);
    }
  }

  for (const product of tree.products) {
    if (product.status !== "ok") continue;
    const { package: pkg, filePaths } = product;
    for (const term of pkg.glossary) {
      const filePath = filePaths.glossary ?? filePaths.background;
      const existing = termIds.get(term.id);
      if (existing) return `Duplicate term id "${term.id}" found in ${existing} and ${filePath}`;
      termIds.set(term.id, filePath);
    }
    if (pkg.writingGuide) {
      for (const rule of pkg.writingGuide.rules) {
        const filePath = filePaths.writingGuide ?? filePaths.background;
        const existing = ruleIds.get(rule.id);
        if (existing) return `Duplicate rule id "${rule.id}" found in ${existing} and ${filePath}`;
        ruleIds.set(rule.id, filePath);
      }
    }
  }

  return undefined;
}

export async function discoverGuidelines(rootDir?: string): Promise<GuidelineTreeResult> {
  const dir = rootDir ?? guidelinesDir();
  await mkdir(dir, { recursive: true });
  await scaffoldIfAbsent(dir);

  const errors: ParseError[] = [];

  const companyBasePath = join(dir, "company-base.md");
  const softwareWritingPath = join(dir, "software-writing.md");
  const companyGlossaryCsv = join(dir, "company-glossary.csv");
  const companyGlossaryMd = join(dir, "company-glossary.md");

  const companyBaseMissing = !(await fileExists(companyBasePath));
  const softwareWritingMissing = !(await fileExists(softwareWritingPath));

  let companyBase: FileParseResult<Guideline> | null = null;
  if (!companyBaseMissing) {
    companyBase = await parseGuidelineFile(companyBasePath);
    if (companyBase.status === "error") errors.push(companyBase.error);
  }

  let softwareWriting: FileParseResult<Guideline> | null = null;
  if (!softwareWritingMissing) {
    softwareWriting = await parseGuidelineFile(softwareWritingPath);
    if (softwareWriting.status === "error") errors.push(softwareWriting.error);
  }

  const hasCsv = await fileExists(companyGlossaryCsv);
  const hasMd = await fileExists(companyGlossaryMd);
  const companyGlossaryMissing = !hasCsv && !hasMd;

  let companyGlossary: FileParseResult<Term[]> | null = null;
  if (hasCsv && hasMd) {
    errors.push({
      file: dir,
      message: "Both company-glossary.csv and company-glossary.md exist; keep only one."
    });
  } else if (hasCsv) {
    companyGlossary = await parseCompanyGlossaryFile(companyGlossaryCsv, "csv");
    if (companyGlossary.status === "error") errors.push(companyGlossary.error);
  } else if (hasMd) {
    companyGlossary = await parseCompanyGlossaryFile(companyGlossaryMd, "md");
    if (companyGlossary.status === "error") errors.push(companyGlossary.error);
  }

  const products: ProductPackageResult[] = [];
  const productsDir = join(dir, "products");
  if (await fileExists(productsDir)) {
    const entries = await readdir(productsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const productDir = join(productsDir, entry.name);
      const discovered = await discoverProductPackage(productDir, entry.name);
      if (discovered) products.push(discovered);
    }
  }

  const tree: GuidelineTreeResult = {
    companyBase,
    softwareWriting,
    companyGlossary,
    products,
    errors,
    companyBaseMissing,
    softwareWritingMissing,
    companyGlossaryMissing,
    conflictError: undefined
  };

  tree.conflictError = detectDuplicateIds(tree);
  return tree;
}
