import { z } from "zod";

export const localModelStatusSchema = z.enum([
  "not_installed",
  "downloading",
  "verifying",
  "installed",
  "ready",
  "failed"
]);

export const localModelManifestSchema = z.object({
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  sourceRepo: z.string().min(1),
  fileName: z.string().min(1),
  downloadUrl: z.string().url(),
  expectedSha256: z.string().length(64),
  gated: z.boolean(),
  modelMaxContext: z.number().int().positive(),
  defaultContext: z.number().int().positive(),
  fileSizeBytes: z.number().int().positive()
});

export const localModelProgressSchema = z.object({
  downloadedBytes: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative()
});

export const localModelVerificationResultSchema = z.object({
  ok: z.boolean(),
  expectedSha256: z.string().min(1),
  actualSha256: z.string().optional(),
  message: z.string().optional()
});

export const localModelStateSchema = z.object({
  status: localModelStatusSchema,
  modelPath: z.string().nullable(),
  downloadedBytes: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  errorMessage: z.string().nullable(),
  installedAt: z.iso.datetime().nullable()
});

export const localModelStatusResponseSchema = z.object({
  manifest: localModelManifestSchema,
  state: localModelStateSchema
});

export type LocalModelStatus = z.infer<typeof localModelStatusSchema>;
export type LocalModelManifest = z.infer<typeof localModelManifestSchema>;
export type LocalModelProgress = z.infer<typeof localModelProgressSchema>;
export type LocalModelVerificationResult = z.infer<typeof localModelVerificationResultSchema>;
export type LocalModelState = z.infer<typeof localModelStateSchema>;
export type LocalModelStatusResponse = z.infer<typeof localModelStatusResponseSchema>;

export function parseLocalModelStatusResponse(payload: unknown): LocalModelStatusResponse {
  return localModelStatusResponseSchema.parse(payload);
}
