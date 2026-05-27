import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { z } from "zod";

import { guidelinesDir } from "./discovery";

const META_BASENAME = ".upload-display-names.json";

const slotDisplayNamesSchema = z.object({
  companyBase: z.string().min(1).optional(),
  softwareWriting: z.string().min(1).optional(),
  products: z
    .record(
      z.string(),
      z.object({
        background: z.string().min(1).optional(),
        glossary: z.string().min(1).optional(),
        writingGuide: z.string().min(1).optional()
      })
    )
    .optional()
});

export type SlotDisplayNames = z.infer<typeof slotDisplayNamesSchema>;

export type ProductSlotKind = "background" | "glossary" | "writing-guide";

export function displayLabelFromSource(filename: string | undefined): string | undefined {
  if (!filename?.trim()) return undefined;
  const base = basename(filename.trim());
  return base.length > 0 ? base : undefined;
}

function metaPath(): string {
  return join(guidelinesDir(), META_BASENAME);
}

export async function loadSlotDisplayNames(): Promise<SlotDisplayNames> {
  try {
    const raw = await readFile(metaPath(), "utf8");
    return slotDisplayNamesSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function saveSlotDisplayNames(data: SlotDisplayNames): Promise<void> {
  const dir = guidelinesDir();
  await mkdir(dir, { recursive: true });
  await writeFile(metaPath(), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function setCompanyBaseDisplayName(name: string): Promise<void> {
  const data = await loadSlotDisplayNames();
  data.companyBase = name;
  await saveSlotDisplayNames(data);
}

export async function setSoftwareWritingDisplayName(name: string): Promise<void> {
  const data = await loadSlotDisplayNames();
  data.softwareWriting = name;
  await saveSlotDisplayNames(data);
}

function productMetaKey(productId: string): string {
  return productId.trim().toLowerCase();
}

export async function setProductSlotDisplayName(
  productId: string,
  slot: ProductSlotKind,
  name: string
): Promise<void> {
  const data = await loadSlotDisplayNames();
  const products = { ...data.products };
  const key = productMetaKey(productId);
  const entry = { ...products[key] };
  if (slot === "background") entry.background = name;
  if (slot === "glossary") entry.glossary = name;
  if (slot === "writing-guide") entry.writingGuide = name;
  products[key] = entry;
  data.products = products;
  await saveSlotDisplayNames(data);
}

export async function clearCompanyBaseDisplayName(): Promise<void> {
  const data = await loadSlotDisplayNames();
  delete data.companyBase;
  await saveSlotDisplayNames(data);
}

export async function clearSoftwareWritingDisplayName(): Promise<void> {
  const data = await loadSlotDisplayNames();
  delete data.softwareWriting;
  await saveSlotDisplayNames(data);
}

export async function clearProductSlotDisplayName(
  productId: string,
  slot: ProductSlotKind
): Promise<void> {
  const data = await loadSlotDisplayNames();
  const key = productMetaKey(productId);
  const entry = data.products?.[key];
  if (!entry) return;
  const next = { ...entry };
  if (slot === "background") delete next.background;
  if (slot === "glossary") delete next.glossary;
  if (slot === "writing-guide") delete next.writingGuide;
  const products = { ...data.products };
  if (Object.keys(next).length === 0) {
    delete products[key];
  } else {
    products[key] = next;
  }
  data.products = Object.keys(products).length > 0 ? products : undefined;
  await saveSlotDisplayNames(data);
}

export async function clearProductDisplayNames(productId: string): Promise<void> {
  const data = await loadSlotDisplayNames();
  const key = productMetaKey(productId);
  if (!data.products?.[key]) return;
  const products = { ...data.products };
  delete products[key];
  data.products = Object.keys(products).length > 0 ? products : undefined;
  await saveSlotDisplayNames(data);
}
