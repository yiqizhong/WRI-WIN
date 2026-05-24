import { z } from "zod";

import { productBackgroundSchema, termSchema } from "./guideline";

const uploadContentSchema = z.object({
  content: z.string().min(1),
  overwrite: z.boolean().optional()
});

export const uploadCompanyBaseInputSchema = uploadContentSchema;

export const uploadSoftwareWritingInputSchema = uploadContentSchema;

export const uploadCompanyGlossaryInputSchema = z.object({
  content: z.string().min(1),
  format: z.enum(["csv", "md"]),
  overwrite: z.boolean().optional()
});

export const uploadProductBackgroundInputSchema = z.object({
  productId: z.string().min(1),
  content: z.string().min(1),
  overwrite: z.boolean().optional()
});

export const uploadProductGlossaryInputSchema = z.object({
  productId: z.string().min(1),
  content: z.string().min(1),
  format: z.enum(["csv", "md"]),
  overwrite: z.boolean().optional()
});

export const uploadProductWritingGuideInputSchema = z.object({
  productId: z.string().min(1),
  content: z.string().min(1),
  overwrite: z.boolean().optional()
});

export const productUploadFileSchema = z.object({
  filename: z.string().min(1),
  content: z.string()
});

export const createProductInputSchema = z.object({
  id: z.string().min(1),
  content: z.string().optional(),
  files: z.array(productUploadFileSchema).optional()
});

export const glossaryFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  format: z.enum(["csv", "md"]),
  terms: z.array(termSchema),
  filePath: z.string().min(1),
  contentHash: z.string().min(1),
  updatedAt: z.iso.datetime()
});

export const glossaryListItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  format: z.enum(["csv", "md"]),
  termCount: z.number().int().nonnegative(),
  filePath: z.string().min(1),
  parseStatus: z.enum(["ok", "error"]),
  parseError: z
    .object({
      file: z.string().min(1),
      line: z.number().int().positive().optional(),
      message: z.string().min(1)
    })
    .optional()
});

export const glossaryListSchema = z.object({
  glossaries: z.array(glossaryListItemSchema)
});

export const uploadResultSchema = z.object({
  ok: z.boolean(),
  filePath: z.string().min(1).optional(),
  message: z.string().optional()
});

export type UploadCompanyBaseInput = z.infer<typeof uploadCompanyBaseInputSchema>;
export type UploadSoftwareWritingInput = z.infer<typeof uploadSoftwareWritingInputSchema>;
export type UploadCompanyGlossaryInput = z.infer<typeof uploadCompanyGlossaryInputSchema>;
export type UploadProductBackgroundInput = z.infer<typeof uploadProductBackgroundInputSchema>;
export type UploadProductGlossaryInput = z.infer<typeof uploadProductGlossaryInputSchema>;
export type UploadProductWritingGuideInput = z.infer<typeof uploadProductWritingGuideInputSchema>;
export type CreateProductInput = z.infer<typeof createProductInputSchema>;
export type GlossaryFile = z.infer<typeof glossaryFileSchema>;
export type GlossaryListItem = z.infer<typeof glossaryListItemSchema>;
export type GlossaryList = z.infer<typeof glossaryListSchema>;
export type UploadResult = z.infer<typeof uploadResultSchema>;

export function parseUploadCompanyBaseInput(payload: unknown): UploadCompanyBaseInput {
  return uploadCompanyBaseInputSchema.parse(payload);
}

export function parseUploadSoftwareWritingInput(payload: unknown): UploadSoftwareWritingInput {
  return uploadSoftwareWritingInputSchema.parse(payload);
}

export function parseUploadCompanyGlossaryInput(payload: unknown): UploadCompanyGlossaryInput {
  return uploadCompanyGlossaryInputSchema.parse(payload);
}

export function parseUploadProductBackgroundInput(payload: unknown): UploadProductBackgroundInput {
  return uploadProductBackgroundInputSchema.parse(payload);
}

export function parseUploadProductGlossaryInput(payload: unknown): UploadProductGlossaryInput {
  return uploadProductGlossaryInputSchema.parse(payload);
}

export function parseUploadProductWritingGuideInput(payload: unknown): UploadProductWritingGuideInput {
  return uploadProductWritingGuideInputSchema.parse(payload);
}

export function parseCreateProductInput(payload: unknown): CreateProductInput {
  return createProductInputSchema.parse(payload);
}

export function parseGlossaryList(payload: unknown): GlossaryList {
  return glossaryListSchema.parse(payload);
}

export function parseUploadResult(payload: unknown): UploadResult {
  return uploadResultSchema.parse(payload);
}

/** @deprecated use uploadCompanyGlossaryInputSchema */
export const uploadGlossaryInputSchema = uploadCompanyGlossaryInputSchema;

/** @deprecated */
export type UploadGlossaryInput = UploadCompanyGlossaryInput;

/** @deprecated use parseUploadCompanyGlossaryInput */
export function parseUploadGlossaryInput(payload: unknown): UploadCompanyGlossaryInput {
  return parseUploadCompanyGlossaryInput(payload);
}
