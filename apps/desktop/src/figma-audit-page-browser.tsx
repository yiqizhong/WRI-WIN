import { Loader2 } from "lucide-react";
import { useState } from "react";

import type { ListPageFramesResponse, PageFrameListItem } from "@writer/contracts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DaemonClientError } from "./daemon-client";
import type { WorkflowSubmitPayload } from "./figma-audit-workflow-tabs";

type FigmaAuditPageBrowserProps = {
  disabled?: boolean;
  onSubmit: (payload: WorkflowSubmitPayload) => void;
  onListPageFrames: (pageUrl: string) => Promise<ListPageFramesResponse>;
};

export function directionLabel(direction: ListPageFramesResponse["detectedDirection"]): string {
  if (direction === "horizontal") {
    return "Detected flow direction: left to right";
  }

  if (direction === "vertical") {
    return "Detected flow direction: top to bottom";
  }

  return "Detected flow direction: grid (row-major)";
}

type CheckedFrame = PageFrameListItem & { checked: boolean };

export function reorderFrames(frames: CheckedFrame[], from: number, to: number): CheckedFrame[] {
  const copy = [...frames];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

export function FigmaAuditPageBrowser({ disabled, onSubmit, onListPageFrames }: FigmaAuditPageBrowserProps) {
  const [pageUrl, setPageUrl] = useState("");
  const [frames, setFrames] = useState<Array<PageFrameListItem & { checked: boolean }>>([]);
  const [direction, setDirection] = useState<ListPageFramesResponse["detectedDirection"] | null>(null);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadFrames() {
    setError(null);
    setLoading(true);
    setDirection(null);
    setFrames([]);
    setFileKey(null);

    try {
      const match = pageUrl.match(/figma\.com\/design\/([^/]+)/);
      const parsedFileKey = match?.[1] ?? null;

      if (!parsedFileKey) {
        setError("Paste a Figma design page URL.");
        return;
      }

      const response = await onListPageFrames(pageUrl);
      setFileKey(parsedFileKey);
      setDirection(response.detectedDirection);
      setFrames(response.frames.map((frame) => ({ ...frame, checked: true })));
    } catch (error) {
      setError(
        error instanceof DaemonClientError
          ? error.message
          : "Could not load frames. Check the page URL and Figma MCP connection."
      );
    } finally {
      setLoading(false);
    }
  }

  const controlsDisabled = disabled || loading;

  function handleSubmit() {
    if (!fileKey) {
      setError("Load frames before submitting.");
      return;
    }

    const nodeIds = frames.filter((frame) => frame.checked).map((frame) => frame.nodeId);

    if (nodeIds.length === 0) {
      setError("Select at least one frame.");
      return;
    }

    onSubmit({ fileKey, nodeIds });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={pageUrl}
          disabled={controlsDisabled}
          placeholder="https://www.figma.com/design/... (page URL, not a single frame)"
          onChange={(event) => setPageUrl(event.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={controlsDisabled || !pageUrl.trim()}
          onClick={() => void loadFrames()}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading…
            </span>
          ) : (
            "Load frames"
          )}
        </Button>
      </div>

      {loading ? (
        <p
          className="writer-home-text flex items-center gap-2 text-sm text-[#e5f1ff]/80"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          Fetching frames from Figma via MCP…
        </p>
      ) : null}

      <p className="writer-home-text text-xs text-[#e5f1ff]/60">
        Paste the Figma page link (from the left sidebar), not a single frame link. Only UI frames are
        listed; sections and other shapes are skipped.
      </p>

      {direction ? (
        <p className="writer-home-text text-sm text-[#e5f1ff]/80">{directionLabel(direction)}</p>
      ) : null}

      {frames.map((frame, index) => (
        <div key={frame.nodeId} className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2">
          <input
            type="checkbox"
            checked={frame.checked}
            disabled={controlsDisabled}
            onChange={(event) => {
              setFrames((current) =>
                current.map((item) =>
                  item.nodeId === frame.nodeId ? { ...item, checked: event.target.checked } : item
                )
              );
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="writer-home-text text-sm text-[#e5f1ff]">{frame.name}</p>
            <p className="writer-home-text truncate text-xs text-[#e5f1ff]/60">{frame.parentPath}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={controlsDisabled || index === 0}
            onClick={() => setFrames((current) => reorderFrames(current, index, index - 1))}
          >
            Up
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={controlsDisabled || index === frames.length - 1}
            onClick={() => setFrames((current) => reorderFrames(current, index, index + 1))}
          >
            Down
          </Button>
        </div>
      ))}

      {frames.length > 0 ? (
        <Button type="button" disabled={controlsDisabled} onClick={handleSubmit}>
          Use selected frames
        </Button>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
