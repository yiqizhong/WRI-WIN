import type { SpreadsheetMappingInput, SpreadsheetParseResult } from "@writer/contracts";
import { Dropdown, Stack, Tile } from "@carbon/react";

import { fillWidth, hugHeight, row, surface } from "./layout/writer-sizing";

type SpreadsheetMappingPanelProps = {
  parsed: SpreadsheetParseResult | null;
  mapping: SpreadsheetMappingInput | null;
  onMappingChange: (mapping: SpreadsheetMappingInput) => void;
};

const ROLES = ["source", "suggestion", "status", "note"] as const;

export function SpreadsheetMappingPanel({ parsed, mapping, onMappingChange }: SpreadsheetMappingPanelProps) {
  if (!parsed) {
    return null;
  }

  const spreadsheet = parsed;

  const current = mapping ?? {
    source: spreadsheet.suggestedMapping.source ?? 0,
    suggestion: spreadsheet.suggestedMapping.suggestion,
    status: spreadsheet.suggestedMapping.status,
    note: spreadsheet.suggestedMapping.note
  };

  function columnItems(role: keyof SpreadsheetMappingInput) {
    return [
      { id: "", label: "—" },
      ...spreadsheet.columns.map((column) => ({
        id: String(column.index),
        label: `${column.header} (${column.role})`
      }))
    ];
  }

  function selectedItem(role: keyof SpreadsheetMappingInput) {
    const items = columnItems(role);
    const value = current[role];
    return items.find((item) => item.id === (value === undefined ? "" : String(value))) ?? items[0];
  }

  function updateField(role: keyof SpreadsheetMappingInput, selectedId: string) {
    const index = selectedId === "" ? undefined : Number(selectedId);
    onMappingChange({ ...current, [role]: index });
  }

  return (
    <Tile className={`${surface} ${fillWidth}`} style={{ background: "var(--cds-layer-02)" }}>
      <Stack gap={5}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Column mapping</h2>
        <p style={{ margin: 0, color: "var(--cds-text-secondary)" }}>
          Confirm which columns hold source copy, suggestions, status, and notes before running audit.
        </p>
        <Stack gap={5} orientation="horizontal" className={`${row} ${hugHeight}`}>
          {ROLES.map((role) => (
            <div key={role} className={hugHeight}>
            <Dropdown
              id={`mapping-${role}`}
              titleText={role}
              label={selectedItem(role).label}
              items={columnItems(role)}
              itemToString={(item) => item?.label ?? ""}
              selectedItem={selectedItem(role)}
              onChange={({ selectedItem: next }) => {
                if (next) {
                  updateField(role, next.id);
                }
              }}
              size="md"
            />
            </div>
          ))}
        </Stack>
      </Stack>
    </Tile>
  );
}
