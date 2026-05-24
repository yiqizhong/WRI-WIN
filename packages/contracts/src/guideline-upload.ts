import { z } from "zod";

import { termSchema } from "./guideline";

export const uploadGuidelineInputSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  scope: z.enum(["company", "product"]),
  overwrite: z.boolean().optional()
});

export const uploadGlossaryInputSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  format: z.enum(["csv", "md"]),
  overwrite: z.boolean().optional()
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

export type UploadGuidelineInput = z.infer<typeof uploadGuidelineInputSchema>;
export type UploadGlossaryInput = z.infer<typeof uploadGlossaryInputSchema>;
export type GlossaryFile = z.infer<typeof glossaryFileSchema>;
export type GlossaryListItem = z.infer<typeof glossaryListItemSchema>;
export type GlossaryList = z.infer<typeof glossaryListSchema>;
export type UploadResult = z.infer<typeof uploadResultSchema>;

export function parseUploadGuidelineInput(payload: unknown): UploadGuidelineInput {
  return uploadGuidelineInputSchema.parse(payload);
}

export function parseUploadGlossaryInput(payload: unknown): UploadGlossaryInput {
  return uploadGlossaryInputSchema.parse(payload);
}

export function parseGlossaryList(payload: unknown): GlossaryList {
  return glossaryListSchema.parse(payload);
}

export function parseUploadResult(payload: unknown): UploadResult {
  return uploadResultSchema.parse(payload);
}
