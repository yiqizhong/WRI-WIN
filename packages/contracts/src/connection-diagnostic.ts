import { z } from "zod";

export const connectionDiagnosticCodeSchema = z.enum([
  "missing_command",
  "broken_executable",
  "version_probe_failed",
  "needs_auth",
  "timeout",
  "smoke_failed",
  "not_configured",
  "startup_failed",
  "tool_not_found",
  "mcp_not_ready",
  "unsupported_figma_source",
  "unsupported_source",
  "partial_read_failure",
  "write_conflict",
  "write_failed",
  "not_installed",
  "downloading",
  "verifying",
  "install_failed",
  "ready"
]);

export const connectionDiagnosticSeveritySchema = z.enum(["info", "warning", "error"]);

export const connectionDiagnosticSchema = z.object({
  code: connectionDiagnosticCodeSchema,
  severity: connectionDiagnosticSeveritySchema,
  message: z.string().min(1),
  recoveryAction: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
  exitCode: z.number().int().nullable().optional(),
  stdoutSnippet: z.string().optional(),
  stderrSnippet: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type ConnectionDiagnosticCode = z.infer<typeof connectionDiagnosticCodeSchema>;
export type ConnectionDiagnosticSeverity = z.infer<typeof connectionDiagnosticSeveritySchema>;
export type ConnectionDiagnostic = z.infer<typeof connectionDiagnosticSchema>;

export function parseConnectionDiagnostic(payload: unknown): ConnectionDiagnostic {
  return connectionDiagnosticSchema.parse(payload);
}

export function redactDiagnosticMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactDiagnosticMetadata(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSecretLikeKey(key) ? "[redacted]" : redactDiagnosticMetadata(entry)
    ])
  );
}

function isSecretLikeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes("token") || normalized.includes("apikey") || normalized.includes("api_key") || normalized.includes("secret");
}
