/** Label for an uploaded guideline file row (basename with extension). */
export function formatUploadedFileLabel(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return filename;
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

export function productSlotFilename(
  hasFile: boolean,
  filename: string | undefined,
  fallback: string
): string | undefined {
  if (!hasFile) return undefined;
  return formatUploadedFileLabel(filename ?? fallback);
}

export type StagedGuidelineFile = { filename: string; content: string };

export type NewProductFileSlots = {
  background?: StagedGuidelineFile;
  glossary?: StagedGuidelineFile;
  writingGuide?: StagedGuidelineFile;
};

export const EMPTY_NEW_PRODUCT_FILE_SLOTS: NewProductFileSlots = {};

export function collectNewProductFiles(slots: NewProductFileSlots): StagedGuidelineFile[] {
  return [slots.background, slots.glossary, slots.writingGuide].filter(
    (file): file is StagedGuidelineFile => Boolean(file)
  );
}
