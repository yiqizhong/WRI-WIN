import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/writer/glass-card";
import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";

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
    <div className="flex flex-col gap-4">
      {rows.map((value, index) => (
        <GlassCard
          key={`step-${index}`}
          variant="outline"
          className="flex items-center gap-2 px-3 py-2"
        >
          <span className="writer-home-text w-8 shrink-0 text-sm text-[#e5f1ff]/70">#{index + 1}</span>
          <Input
            value={value}
            disabled={disabled}
            placeholder="https://www.figma.com/design/..."
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
            onChange={(event) => {
              const next = [...rows];
              next[index] = event.target.value;
              setRows(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || index === 0}
            onClick={() => moveRow(index, -1)}
          >
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
        </GlassCard>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setRows((current) => [...current, ""])}
        >
          Add step
        </Button>
        <WriterPrimaryButton type="button" disabled={disabled} onClick={() => void handleSubmit()}>
          Use these frames
        </WriterPrimaryButton>
      </div>
      {error ? <InlineAlert kind="error" title="Frame URLs" subtitle={error} onClose={() => setError(null)} /> : null}
    </div>
  );
}
