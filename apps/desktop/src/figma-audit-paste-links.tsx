import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { WorkflowSubmitPayload } from "./figma-audit-workflow-tabs";

type FigmaAuditPasteLinksProps = {
  disabled?: boolean;
  onSubmit: (payload: WorkflowSubmitPayload) => void;
  onParseUrl: (url: string) => Promise<{ fileKey: string; nodeId?: string }>;
};

export function buildWorkflowNodeIds(urls: string[]): string[] {
  return urls.map((url) => url.trim()).filter(Boolean);
}

export function FigmaAuditPasteLinks({ disabled, onSubmit, onParseUrl }: FigmaAuditPasteLinksProps) {
  const [rows, setRows] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string | null>(null);

  function moveRow(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= rows.length) {
      return;
    }

    setRows((current) => {
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, row ?? "");
      return copy;
    });
  }

  async function handleSubmit() {
    setError(null);
    const urls = buildWorkflowNodeIds(rows);

    if (urls.length === 0) {
      setError("Add at least one frame URL.");
      return;
    }

    try {
      const parsedFrames = await Promise.all(urls.map((url) => onParseUrl(url)));
      const fileKey = parsedFrames[0]?.fileKey;

      if (!fileKey || parsedFrames.some((frame) => frame.fileKey !== fileKey)) {
        setError("All frame URLs must belong to the same Figma file.");
        return;
      }

      const nodeIds = parsedFrames
        .map((frame) => frame.nodeId)
        .filter((nodeId): nodeId is string => Boolean(nodeId));

      if (nodeIds.length !== urls.length) {
        setError("Each URL must include a frame node-id.");
        return;
      }

      onSubmit({ fileKey, nodeIds });
    } catch {
      setError("Could not parse one or more frame URLs.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((value, index) => (
        <div key={`step-${index}`} className="flex items-center gap-2">
          <span className="writer-home-text w-8 text-sm text-[#e5f1ff]/70">#{index + 1}</span>
          <Input
            value={value}
            disabled={disabled}
            placeholder="https://www.figma.com/design/..."
            onChange={(event) => {
              const next = [...rows];
              next[index] = event.target.value;
              setRows(next);
            }}
          />
          <Button type="button" variant="ghost" size="sm" disabled={disabled || index === 0} onClick={() => moveRow(index, -1)}>
            Up
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || index === rows.length - 1}
            onClick={() => moveRow(index, 1)}
          >
            Down
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={disabled} onClick={() => setRows((current) => [...current, ""])}>
          Add step
        </Button>
        <Button type="button" disabled={disabled} onClick={() => void handleSubmit()}>
          Use these frames
        </Button>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
