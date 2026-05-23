import { z } from "zod";

export const spreadsheetColumnRoleSchema = z.enum([
  "source",
  "suggestion",
  "status",
  "note",
  "ignore"
]);

export const spreadsheetColumnSchema = z.object({
  index: z.number().int().nonnegative(),
  header: z.string(),
  role: spreadsheetColumnRoleSchema,
  confidence: z.number().min(0).max(1)
});

export const spreadsheetRowSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  cells: z.record(z.string(), z.string())
});

export const spreadsheetParseResultSchema = z.object({
  fileName: z.string().min(1),
  format: z.enum(["csv", "xlsx"]),
  columns: z.array(spreadsheetColumnSchema),
  rows: z.array(spreadsheetRowSchema),
  suggestedMapping: z.object({
    source: z.number().int().nonnegative().optional(),
    suggestion: z.number().int().nonnegative().optional(),
    status: z.number().int().nonnegative().optional(),
    note: z.number().int().nonnegative().optional()
  })
});

export const spreadsheetMappingInputSchema = z.object({
  source: z.number().int().nonnegative(),
  suggestion: z.number().int().nonnegative().optional(),
  status: z.number().int().nonnegative().optional(),
  note: z.number().int().nonnegative().optional()
});

export type SpreadsheetColumnRole = z.infer<typeof spreadsheetColumnRoleSchema>;
export type SpreadsheetParseResult = z.infer<typeof spreadsheetParseResultSchema>;
export type SpreadsheetMappingInput = z.infer<typeof spreadsheetMappingInputSchema>;

export function parseSpreadsheetParseResult(payload: unknown): SpreadsheetParseResult {
  return spreadsheetParseResultSchema.parse(payload);
}
