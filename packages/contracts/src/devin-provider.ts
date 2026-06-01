import { z } from "zod";

export const devinReasoningPreferenceSchema = z.enum(["off", "low", "medium", "high"]);
export const devinReasoningCapabilityStatusSchema = z.enum([
  "applied",
  "mapped",
  "unsupported",
  "advisory"
]);

export const devinProviderSettingsSchema = z.object({
  modelId: z.string().min(1).default("swe-1.6"),
  reasoningPreference: devinReasoningPreferenceSchema.default("medium"),
  reasoningCapabilityStatus: devinReasoningCapabilityStatusSchema.default("advisory")
});

export const devinRuntimeOptionsSchema = z.object({
  modelOptions: z.array(z.string().min(1)).default([]),
  modelLabels: z.record(z.string(), z.string()).default({}),
  reasoningOptions: z.array(devinReasoningPreferenceSchema).default([])
});

export type DevinReasoningPreference = z.infer<typeof devinReasoningPreferenceSchema>;
export type DevinReasoningCapabilityStatus = z.infer<typeof devinReasoningCapabilityStatusSchema>;
export type DevinProviderSettings = z.infer<typeof devinProviderSettingsSchema>;
export type DevinRuntimeOptions = z.infer<typeof devinRuntimeOptionsSchema>;

export function parseDevinProviderSettings(payload: unknown): DevinProviderSettings {
  return devinProviderSettingsSchema.parse(payload);
}

export function parseDevinRuntimeOptions(payload: unknown): DevinRuntimeOptions {
  return devinRuntimeOptionsSchema.parse(payload);
}
