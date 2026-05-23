import { writeFile } from "node:fs/promises";
import { extname } from "node:path";

import type { ReviewChange, SpreadsheetMappingInput, SpreadsheetParseResult } from "@writer/contracts";

export type SpreadsheetExportInput = {
  parsed: SpreadsheetParseResult;
  mapping: SpreadsheetMappingInput;
  changes: ReviewChange[];
  outputPath: string;
};

export async function exportSpreadsheetFile(input: SpreadsheetExportInput): Promise<{ outputPath: string; rowCount: number }> {
  const extension = extname(input.outputPath).toLowerCase();

  if (extension === ".csv") {
    return exportCsv(input);
  }

  if (extension === ".xlsx") {
    return exportXlsx(input);
  }

  throw new Error("Export format must be .csv or .xlsx.");
}

async function exportCsv(input: SpreadsheetExportInput) {
  const headers = buildHeaders(input);
  const lines = [headers.join(",")];

  for (const row of input.parsed.rows) {
    const cells = applyRowChanges(row.cells, row.id, input);
    lines.push(headers.map((header) => escapeCsv(cells[header] ?? "")).join(","));
  }

  await writeFile(input.outputPath, `${lines.join("\n")}\n`, "utf8");

  return { outputPath: input.outputPath, rowCount: input.parsed.rows.length };
}

async function exportXlsx(input: SpreadsheetExportInput) {
  let XLSX: typeof import("xlsx");

  try {
    XLSX = await import("xlsx");
  } catch {
    throw new Error("XLSX export requires the xlsx package.");
  }

  const headers = buildHeaders(input);
  const matrix = [
    headers,
    ...input.parsed.rows.map((row) => {
      const cells = applyRowChanges(row.cells, row.id, input);
      return headers.map((header) => cells[header] ?? "");
    })
  ];

  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Review");
  XLSX.writeFile(workbook, input.outputPath);

  return { outputPath: input.outputPath, rowCount: input.parsed.rows.length };
}

function buildHeaders(input: SpreadsheetExportInput): string[] {
  const baseHeaders = input.parsed.columns.map((column) => column.header);
  const extras = ["Writer Status", "Writer Rationale"];

  if (input.mapping.suggestion === undefined) {
    extras.unshift("Writer Suggestion");
  }

  return [...baseHeaders, ...extras.filter((header) => !baseHeaders.includes(header))];
}

function applyRowChanges(
  cells: Record<string, string>,
  rowId: string,
  input: SpreadsheetExportInput
): Record<string, string> {
  const next = { ...cells };
  const change = input.changes.find(
    (item) => item.sourceId === rowId && (item.status === "approved" || item.status === "edited" || item.status === "applied")
  );

  if (!change) {
    next["Writer Status"] = "pending";
    return next;
  }

  const sourceHeader = input.parsed.columns.find((column) => column.index === input.mapping.source)?.header;
  const suggestionHeader =
    input.mapping.suggestion !== undefined
      ? input.parsed.columns.find((column) => column.index === input.mapping.suggestion)?.header
      : "Writer Suggestion";

  if (suggestionHeader) {
    next[suggestionHeader] = change.after;
  }

  if (sourceHeader) {
    next[sourceHeader] = change.before;
  }

  next["Writer Status"] = change.status;
  next["Writer Rationale"] = change.rationale ?? "";

  return next;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}
