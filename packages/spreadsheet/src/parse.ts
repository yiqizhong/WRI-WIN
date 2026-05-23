import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import type { SpreadsheetParseResult } from "@writer/contracts";

import { detectColumnMapping } from "./columns";
import { splitCsvLine } from "./parse-utils";

export async function parseSpreadsheetFile(filePath: string): Promise<SpreadsheetParseResult> {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".csv") {
    return parseCsvFile(filePath);
  }

  if (extension === ".xlsx" || extension === ".xls") {
    return parseXlsxFile(filePath);
  }

  throw new Error("Unsupported spreadsheet format. Use .csv or .xlsx.");
}

async function parseCsvFile(filePath: string): Promise<SpreadsheetParseResult> {
  const raw = await readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const headers = splitCsvLine(lines[0] ?? "");
  const rows = lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const cells: Record<string, string> = {};

    headers.forEach((header, columnIndex) => {
      cells[header] = values[columnIndex] ?? "";
    });

    return {
      id: `row-${index + 1}`,
      index,
      cells
    };
  });

  const columns = detectColumnMapping(headers);
  const suggestedMapping = toSuggestedMapping(columns);

  return {
    fileName: basename(filePath),
    format: "csv",
    columns,
    rows,
    suggestedMapping
  };
}

async function parseXlsxFile(filePath: string): Promise<SpreadsheetParseResult> {
  let XLSX: typeof import("xlsx");

  try {
    XLSX = await import("xlsx");
  } catch {
    throw new Error("XLSX support requires the xlsx package. Run npm install in the repo root.");
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Workbook has no sheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" }) as string[][];
  const headerRow = matrix[0] ?? [];

  if (headerRow.length === 0) {
    throw new Error("Spreadsheet has no header row.");
  }

  const headers = headerRow.map((value, index) => String(value || `Column ${index + 1}`));
  const rows = matrix.slice(1).map((row, index) => {
    const cells: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      cells[header] = String(row[columnIndex] ?? "");
    });

    return {
      id: `row-${index + 1}`,
      index,
      cells
    };
  });

  const columns = detectColumnMapping(headers);
  const suggestedMapping = toSuggestedMapping(columns);

  return {
    fileName: basename(filePath),
    format: "xlsx",
    columns,
    rows,
    suggestedMapping
  };
}

function toSuggestedMapping(columns: SpreadsheetParseResult["columns"]) {
  const pick = (role: SpreadsheetParseResult["columns"][number]["role"]) =>
    columns.find((column) => column.role === role)?.index;

  return {
    source: pick("source"),
    suggestion: pick("suggestion"),
    status: pick("status"),
    note: pick("note")
  };
}
