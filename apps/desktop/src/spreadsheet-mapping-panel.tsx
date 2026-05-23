import type { SpreadsheetMappingInput, SpreadsheetParseResult } from "@writer/contracts";

type SpreadsheetMappingPanelProps = {
  parsed: SpreadsheetParseResult | null;
  mapping: SpreadsheetMappingInput | null;
  onMappingChange: (mapping: SpreadsheetMappingInput) => void;
};

export function SpreadsheetMappingPanel({ parsed, mapping, onMappingChange }: SpreadsheetMappingPanelProps) {
  if (!parsed) {
    return null;
  }

  const current = mapping ?? {
    source: parsed.suggestedMapping.source ?? 0,
    suggestion: parsed.suggestedMapping.suggestion,
    status: parsed.suggestedMapping.status,
    note: parsed.suggestedMapping.note
  };

  function updateField(field: keyof SpreadsheetMappingInput, value: string) {
    const index = value === "" ? undefined : Number(value);
    onMappingChange({ ...current, [field]: index });
  }

  return (
    <section className="panel mapping-panel">
      <p className="eyebrow">Spreadsheet</p>
      <h2>Column mapping</h2>
      <p>Confirm which columns hold source copy, suggestions, status, and notes before running audit.</p>
      <div className="mapping-grid">
        {(["source", "suggestion", "status", "note"] as const).map((role) => (
          <label key={role}>
            {role}
            <select
              value={current[role] ?? ""}
              onChange={(event) => updateField(role, event.target.value)}
            >
              <option value="">—</option>
              {parsed.columns.map((column) => (
                <option key={column.index} value={column.index}>
                  {column.header} ({column.role})
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
