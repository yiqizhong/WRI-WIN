import { z } from "zod";

import {
  spreadsheetMappingInputSchema,
  type SpreadsheetMappingInput,
  type SpreadsheetParseResult
} from "@writer/contracts";
import { exportSpreadsheetFile } from "@writer/spreadsheet";

import { buildReportArtifact } from "./review";
import type { DaemonState } from "./state";

const spreadsheetExportSchema = z.object({
  sessionId: z.string().min(1),
  outputPath: z.string().min(1),
  mapping: z.record(z.string(), z.unknown()).optional()
});

export function renderReportHtml(state: DaemonState, sessionId: string): string {
  const artifact = buildReportArtifact(state, sessionId);
  const changeRows = artifact.changes
    .map(
      (change) =>
        `<tr><td>${escapeHtml(change.sourceId)}</td><td>${escapeHtml(change.status)}</td><td>${escapeHtml(change.before)}</td><td>${escapeHtml(change.after)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Writer Review Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; color: #1d1d1b; }
    h1 { font-size: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f4f2ec; }
  </style>
</head>
<body>
  <h1>UX Copy Review Report</h1>
  <p><strong>Session:</strong> ${escapeHtml(artifact.sessionId)}</p>
  <p><strong>Source:</strong> ${escapeHtml(artifact.sourceType)}</p>
  <p><strong>Generated:</strong> ${escapeHtml(artifact.generatedAt)}</p>
  <table>
    <thead><tr><th>Source</th><th>Status</th><th>Before</th><th>After</th></tr></thead>
    <tbody>${changeRows || "<tr><td colspan=\"4\">No changes recorded.</td></tr>"}</tbody>
  </table>
</body>
</html>`;
}

export async function exportSpreadsheetSession(state: DaemonState, input: unknown) {
  const parsed = spreadsheetExportSchema.parse(input);
  const sessions = state.store.listSessions(null);
  const session = sessions.sessions.find((item) => item.id === parsed.sessionId);

  if (!session || session.sourceType !== "spreadsheet") {
    throw new Error("Spreadsheet session not found");
  }

  const scope = session.scope as {
    rows: SpreadsheetParseResult["rows"];
    columns: SpreadsheetParseResult["columns"];
    fileName: string;
    format: SpreadsheetParseResult["format"];
    mapping?: SpreadsheetMappingInput;
  };

  const mapping = parsed.mapping
    ? spreadsheetMappingInputSchema.parse(parsed.mapping)
    : scope.mapping ?? {
        source: scope.columns.find((column) => column.role === "source")?.index ?? 0
      };

  const result = await exportSpreadsheetFile({
    parsed: {
      fileName: scope.fileName,
      format: scope.format,
      columns: scope.columns,
      rows: scope.rows,
      suggestedMapping: {
        source: mapping.source,
        suggestion: mapping.suggestion,
        status: mapping.status,
        note: mapping.note
      }
    },
    mapping,
    changes: state.store.listReviewChanges(parsed.sessionId),
    outputPath: parsed.outputPath
  });

  state.store.appendAuditEntry({
    type: "tool_attempt",
    timestamp: new Date().toISOString(),
    actor: "user",
    summary: `Exported spreadsheet ${scope.fileName}`,
    details: { sessionId: parsed.sessionId, outputPath: result.outputPath, rowCount: result.rowCount }
  });
  await state.store.save();

  return result;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
