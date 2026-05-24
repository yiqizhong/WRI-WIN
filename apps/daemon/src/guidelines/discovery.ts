import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { Guideline, ProductBackground, ProductExtraFile, ProductPackage } from "@writer/contracts";

import { parseProductBackgroundFile } from "./glossary/background-importer";
import { findImporter } from "./importers/index";
import { classifyProductFilename } from "./product-files";
import type { ParseError } from "./importers/index";

export type FileParseResult<T> =
  | { status: "ok"; value: T; filePath: string; contentHash: string }
  | { status: "error"; error: ParseError; filePath: string };

export type ProductPackageResult =
  | {
      status: "ok";
      package: ProductPackage;
      filePaths: { background?: string; glossary?: string; writingGuide?: string };
      contentHashes: Record<string, string>;
    }
  | { status: "error"; productId: string; error: ParseError; filePath: string };

export type GuidelineTreeResult = {
  companyBase: FileParseResult<Guideline> | null;
  softwareWriting: FileParseResult<Guideline> | null;
  products: ProductPackageResult[];
  errors: ParseError[];
  companyBaseMissing: boolean;
  softwareWritingMissing: boolean;
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

async function discoverProductPackage(
  productDir: string,
  productId: string
): Promise<ProductPackageResult | null> {
  const entries = await readdir(productDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && !e.name.startsWith("."));
  if (files.length === 0) {
    return null;
  }

  const contentHashes: Record<string, string> = {};
  let background: ProductBackground | undefined;
  let backgroundPath: string | undefined;
  let glossaryContent: string | undefined;
  let glossaryFormat: "csv" | "md" | undefined;
  let glossaryPath: string | undefined;
  let writingGuide: Guideline | undefined;
  let writingGuideContent: string | undefined;
  let writingGuidePath: string | undefined;
  const extraFiles: ProductExtraFile[] = [];

  for (const entry of files) {
    const filePath = join(productDir, entry.name);
    const raw = await readRaw(filePath);
    if (raw === null) continue;
    contentHashes[filePath] = contentHash(raw);

    const slot = classifyProductFilename(entry.name);
    if (slot.kind === "background" && !background) {
      const bgResult = await parseProductBackgroundFile(filePath, productId);
      if (bgResult.ok) {
        background = bgResult.background;
        backgroundPath = filePath;
      }
      continue;
    }
    if (slot.kind === "glossary" && !glossaryContent) {
      glossaryContent = raw;
      glossaryFormat = slot.format ?? (entry.name.endsWith(".csv") ? "csv" : "md");
      glossaryPath = filePath;
      continue;
    }
    if (slot.kind === "writing-guide" && !writingGuideContent) {
      const wg = await parseGuidelineFile(filePath);
      writingGuideContent = raw;
      writingGuidePath = filePath;
      if (wg.status === "ok") {
        writingGuide = wg.value;
      }
      continue;
    }
    extraFiles.push({ filename: entry.name, content: raw });
  }

  const name = background?.name ?? productId;
  const pkg: ProductPackage = {
    id: productId,
    name,
    background,
    glossary: [],
    glossaryContent,
    glossaryFormat,
    writingGuide,
    writingGuideContent,
    extraFiles
  };

  return {
    status: "ok",
    package: pkg,
    filePaths: { background: backgroundPath, glossary: glossaryPath, writingGuide: writingGuidePath },
    contentHashes
  };
}

export async function discoverGuidelines(rootDir?: string): Promise<GuidelineTreeResult> {
  const dir = rootDir ?? guidelinesDir();
  await mkdir(dir, { recursive: true });
  await scaffoldIfAbsent(dir);

  const errors: ParseError[] = [];

  const companyBasePath = join(dir, "company-base.md");
  const softwareWritingPath = join(dir, "software-writing.md");
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

  return {
    companyBase,
    softwareWriting,
    products,
    errors,
    companyBaseMissing,
    softwareWritingMissing,
    conflictError: undefined
  };
}
