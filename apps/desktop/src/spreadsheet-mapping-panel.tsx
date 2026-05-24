import type { SpreadsheetMappingInput, SpreadsheetParseResult } from "@writer/contracts";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

import { WriterSectionDescription, WriterSectionHeader } from "./layout/writer-headings";
import { fillWidth, surface } from "./layout/writer-sizing";

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

  function selectedValue(role: keyof SpreadsheetMappingInput) {
    const value = current[role];
    return value === undefined ? "" : String(value);
  }

  function updateField(role: keyof SpreadsheetMappingInput, selectedId: string) {
    const index = selectedId === "" ? undefined : Number(selectedId);
    onMappingChange({ ...current, [role]: index });
  }

  return (
    <Card className={`${surface} ${fillWidth} writer-mapping-tile py-4`}>
      <CardContent className="flex flex-col gap-5 px-4">
        <WriterSectionHeader title="Column mapping" />
        <WriterSectionDescription>
          Confirm which columns hold source copy, suggestions, status, and notes before running audit.
        </WriterSectionDescription>
        <div className="writer-mapping-row">
          {ROLES.map((role) => (
            <div key={role} className="writer-mapping-row__cell">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`mapping-${role}`}>{role}</Label>
                <Select
                  value={selectedValue(role)}
                  onValueChange={(next) => updateField(role, next ?? "")}
                >
                  <SelectTrigger id={`mapping-${role}`} className={fillWidth}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columnItems(role).map((item) => (
                      <SelectItem key={item.id || "empty"} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
