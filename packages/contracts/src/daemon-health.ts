import { z } from "zod";

export const capabilityStatusSchema = z.enum(["enabled", "disabled", "degraded"]);

export const daemonCapabilitySchema = z.object({
  id: z.string().min(1),
  status: capabilityStatusSchema,
  message: z.string().optional()
});

export const daemonHealthSchema = z.object({
  status: z.enum(["running", "degraded"]),
  version: z.string().min(1),
  capabilities: z.array(daemonCapabilitySchema)
});

export type DaemonHealth = z.infer<typeof daemonHealthSchema>;
export type DaemonCapability = z.infer<typeof daemonCapabilitySchema>;

export function parseDaemonHealth(payload: unknown): DaemonHealth {
  return daemonHealthSchema.parse(payload);
}

