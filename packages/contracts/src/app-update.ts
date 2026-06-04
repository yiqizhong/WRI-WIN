import { z } from "zod";

export const appUpdateStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("idle") }),
  z.object({ status: z.literal("checking") }),
  z.object({ status: z.literal("available"), version: z.string().min(1), releaseNotes: z.string().min(1).optional() }),
  z.object({ status: z.literal("not-available") }),
  z.object({
    status: z.literal("downloading"),
    percent: z.number().int().min(0).max(100),
    transferredBytes: z.number().int().nonnegative().optional(),
    totalBytes: z.number().int().nonnegative().optional(),
  }),
  z.object({ status: z.literal("downloaded"), version: z.string().min(1) }),
  z.object({ status: z.literal("error"), message: z.string().min(1) })
]);

export type AppUpdateState = z.infer<typeof appUpdateStateSchema>;

export function parseAppUpdateState(payload: unknown): AppUpdateState {
  return appUpdateStateSchema.parse(payload);
}
