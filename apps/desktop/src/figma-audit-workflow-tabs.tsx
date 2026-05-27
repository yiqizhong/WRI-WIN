import { Loader2 } from "lucide-react";
import { useState } from "react";

import type { ListPageFramesResponse } from "@writer/contracts";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/writer/glass-card";
import { InlineAlert } from "@/components/writer/inline-alert";
import {
  WriterFormField,
  WriterFormInput
} from "@/components/writer/writer-form-field";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { cn } from "@/lib/utils";

export type WorkflowSubmitPayload = {
  fileKey: string;
  nodeIds: string[];
};

type WorkflowFrame = {
  nodeId: string;
  name: string;
  parentPath: string;
  checked: boolean;
};

type WorkflowInputMethod = "manual" | "page";

type FigmaAuditWorkflowTabsProps = {
  disabled?: boolean;
  onSubmit: (payload: WorkflowSubmitPayload) => void;
  onParseUrl: (url: string) => Promise<{ fileKey: string; nodeId?: string; suggestedScope: { fileKey: string } }>;
  onListPageFrames: (pageUrl: string) => Promise<ListPageFramesResponse>;
};

function parseFigmaFileKey(url: string): string | null {
  const match = url.match(/figma\.com\/design\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function reorderFrames(frames: WorkflowFrame[], from: number, to: number): WorkflowFrame[] {
  const copy = [...frames];
  const [item] = copy.splice(from, 1);
  if (!item) {
    return frames;
  }

  copy.splice(to, 0, item);
  return copy;
}

export async function detectWorkflowFromPage({
  pageUrl,
  listPageFrames
}: {
  pageUrl: string;
  listPageFrames: FigmaAuditWorkflowTabsProps["onListPageFrames"];
}): Promise<{ fileKey: string; frames: WorkflowFrame[] }> {
  const trimmed = pageUrl.trim();

  if (!trimmed) {
    throw new Error("Paste a Figma page link.");
  }

  const fileKey = parseFigmaFileKey(trimmed);

  if (!fileKey) {
    throw new Error("Paste a Figma design page URL.");
  }

  const response = await listPageFrames(trimmed);

  return {
    fileKey,
    frames: response.frames.map((frame) => ({
      nodeId: frame.nodeId,
      name: frame.name,
      parentPath: frame.parentPath,
      checked: true
    }))
  };
}

export async function buildManualWorkflowFromUrls({
  urls,
  parseFrameUrl
}: {
  urls: string[];
  parseFrameUrl: FigmaAuditWorkflowTabsProps["onParseUrl"];
}): Promise<{ fileKey: string; nodeIds: string[] }> {
  const links = urls.map((url) => url.trim()).filter(Boolean);

  if (links.length === 0) {
    throw new Error("Add at least one frame URL.");
  }

  const parsedFrames = await Promise.all(links.map((url) => parseFrameUrl(url)));
  const fileKey = parsedFrames[0]?.fileKey;

  if (!fileKey || parsedFrames.some((frame) => frame.fileKey !== fileKey)) {
    throw new Error("All frame URLs must belong to the same Figma file.");
  }

  const nodeIds = parsedFrames.map((frame) => {
    if (!frame.nodeId) {
      throw new Error("Each URL must include a frame node-id.");
    }

    return frame.nodeId;
  });

  return { fileKey, nodeIds };
}

const WORKFLOW_METHOD_BUTTON_CLASS =
  "rounded-full border px-[1.125rem] py-[0.4375rem] text-[0.8125rem] font-normal tracking-wide shadow-none";

function WorkflowMethodChoice({
  method,
  disabled,
  onChange
}: {
  method: WorkflowInputMethod;
  disabled?: boolean;
  onChange: (method: WorkflowInputMethod) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Workflow source">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn(
          WORKFLOW_METHOD_BUTTON_CLASS,
          method === "manual"
            ? "border-white/42 bg-white/12 text-[#fafcff] hover:bg-white/16"
            : "border-white/20 bg-transparent text-white/62 hover:border-white/24 hover:text-white/92"
        )}
        onClick={() => onChange("manual")}
      >
        Paste links
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className={cn(
          WORKFLOW_METHOD_BUTTON_CLASS,
          method === "page"
            ? "border-white/42 bg-white/12 text-[#fafcff] hover:bg-white/16"
            : "border-white/20 bg-transparent text-white/62 hover:border-white/24 hover:text-white/92"
        )}
        onClick={() => onChange("page")}
      >
        Detect from page
      </Button>
    </div>
  );
}

export function FigmaAuditWorkflowTabs({
  disabled,
  onSubmit,
  onParseUrl,
  onListPageFrames
}: FigmaAuditWorkflowTabsProps) {
  const [method, setMethod] = useState<WorkflowInputMethod>("manual");
  const [manualRows, setManualRows] = useState<string[]>(["", ""]);
  const [pageUrl, setPageUrl] = useState("");
  const [detectedFrames, setDetectedFrames] = useState<WorkflowFrame[]>([]);
  const [detectedFileKey, setDetectedFileKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const controlsDisabled = disabled || pageLoading || manualSubmitting;

  function moveManualRow(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= manualRows.length) {
      return;
    }

    setManualRows((current) => {
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, row ?? "");
      return copy;
    });
  }

  async function detectPage() {
    setError(null);
    setPageLoading(true);

    try {
      const result = await detectWorkflowFromPage({
        pageUrl,
        listPageFrames: onListPageFrames
      });

      setDetectedFileKey(result.fileKey);
      setDetectedFrames(result.frames);
    } catch (detectError) {
      setError(detectError instanceof Error ? detectError.message : "Could not detect workflow.");
    } finally {
      setPageLoading(false);
    }
  }

  async function submitManual() {
    setError(null);
    setManualSubmitting(true);

    try {
      const result = await buildManualWorkflowFromUrls({
        urls: manualRows,
        parseFrameUrl: onParseUrl
      });

      onSubmit({ fileKey: result.fileKey, nodeIds: result.nodeIds });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not parse frame URLs.");
    } finally {
      setManualSubmitting(false);
    }
  }

  function submitDetected() {
    if (!detectedFileKey) {
      setError("Detect frames from a page link first.");
      return;
    }

    const nodeIds = detectedFrames.filter((frame) => frame.checked).map((frame) => frame.nodeId);

    if (nodeIds.length === 0) {
      setError("Select at least one frame.");
      return;
    }

    onSubmit({ fileKey: detectedFileKey, nodeIds });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkflowMethodChoice
        method={method}
        disabled={controlsDisabled}
        onChange={(next) => {
          setMethod(next);
          setError(null);
        }}
      />

      {method === "manual" ? (
        <div className="flex flex-col gap-4">
          {manualRows.map((value, index) => (
            <div
              key={`manual-step-${index}`}
              className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
            >
              <WriterFormField
                label={`Step ${index + 1}`}
                htmlFor={`figma-workflow-step-${index}`}
                className="min-w-0 flex-1"
              >
                <WriterFormInput
                  id={`figma-workflow-step-${index}`}
                  type="url"
                  value={value}
                  disabled={controlsDisabled}
                  placeholder="https://www.figma.com/design/..."
                  onChange={(event) => {
                    const next = [...manualRows];
                    next[index] = event.target.value;
                    setManualRows(next);
                  }}
                />
              </WriterFormField>
              <div className="flex shrink-0 gap-2 pb-0.5 sm:pb-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/20 bg-transparent text-[#e5f1ff]/80"
                  disabled={controlsDisabled || index === 0}
                  onClick={() => moveManualRow(index, -1)}
                >
                  Up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/20 bg-transparent text-[#e5f1ff]/80"
                  disabled={controlsDisabled || index === manualRows.length - 1}
                  onClick={() => moveManualRow(index, 1)}
                >
                  Down
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={controlsDisabled}
              onClick={() => setManualRows((current) => [...current, ""])}
            >
              Add step
            </Button>
            <WriterPrimaryButton
              type="button"
              disabled={controlsDisabled}
              onClick={() => void submitManual()}
            >
              {manualSubmitting ? "Starting…" : "Start audit"}
            </WriterPrimaryButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <WriterFormField label="Page link" htmlFor="figma-workflow-page-url">
            <WriterFormInput
              id="figma-workflow-page-url"
              type="url"
              value={pageUrl}
              disabled={controlsDisabled}
              placeholder="https://www.figma.com/design/..."
              onChange={(event) => setPageUrl(event.target.value)}
            />
          </WriterFormField>

          <WriterPrimaryButton
            type="button"
            disabled={controlsDisabled || !pageUrl.trim()}
            onClick={() => void detectPage()}
          >
            {pageLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Detecting...
              </span>
            ) : (
              "Detect workflow"
            )}
          </WriterPrimaryButton>

          {detectedFrames.length > 0 ? (
            <div className="flex flex-col gap-3">
              {detectedFrames.map((frame, index) => (
                <GlassCard
                  key={`${frame.nodeId}-${index}`}
                  variant="outline"
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={frame.checked}
                    disabled={controlsDisabled}
                    className="shrink-0"
                    onChange={(event) => {
                      setDetectedFrames((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, checked: event.target.checked } : item
                        )
                      );
                    }}
                  />
                  <span className="writer-home-text w-8 shrink-0 text-sm text-[#e5f1ff]/70">
                    #{index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="writer-home-text m-0 truncate text-sm text-[#e5f1ff]">
                      {frame.name}
                    </p>
                    {frame.parentPath ? (
                      <p className="writer-home-text m-0 truncate text-xs text-[#e5f1ff]/60">
                        {frame.parentPath}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={controlsDisabled || index === 0}
                    onClick={() =>
                      setDetectedFrames((current) => reorderFrames(current, index, index - 1))
                    }
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={controlsDisabled || index === detectedFrames.length - 1}
                    onClick={() =>
                      setDetectedFrames((current) => reorderFrames(current, index, index + 1))
                    }
                  >
                    Down
                  </Button>
                </GlassCard>
              ))}

              <WriterPrimaryButton type="button" disabled={controlsDisabled} onClick={submitDetected}>
                Start audit
              </WriterPrimaryButton>
            </div>
          ) : null}
        </div>
      )}

      {error ? (
        <InlineAlert kind="error" title="Workflow" subtitle={error} onClose={() => setError(null)} />
      ) : null}
    </div>
  );
}
