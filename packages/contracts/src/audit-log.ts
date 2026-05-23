import { z } from "zod";

export const auditLogEntryTypeSchema = z.enum([
  "permission_decision",
  "agent_run_lifecycle",
  "tool_attempt"
]);

export const auditLogEntrySchema = z.object({
  id: z.string().min(1),
  type: auditLogEntryTypeSchema,
  timestamp: z.iso.datetime(),
  actor: z.enum(["user", "system", "agent"]),
  summary: z.string().min(1),
  details: z.record(z.string(), z.unknown()).default({})
});

export const auditLogListSchema = z.object({
  entries: z.array(auditLogEntrySchema)
});

export type AuditLogEntryType = z.infer<typeof auditLogEntryTypeSchema>;
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
export type AuditLogList = z.infer<typeof auditLogListSchema>;
