import { ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ListPageFramesResponse } from "@writer/contracts";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { GlassCard } from "@/components/writer/glass-card";
import { InlineAlert } from "@/components/writer/inline-alert";
import { Label } from "@/components/ui/label";
import { WriterFormInput } from "@/components/writer/writer-form-field";
import {
  WRITER_MINIMAL_TAB_TRIGGER_CLASS,
  WriterMinimalTabsList
} from "@/components/writer/writer-minimal-tabs";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";

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

type ManualStepRow = {
  url: string;
  frameName?: string;
  detecting?: boolean;
};

type ParsedFrameUrl = {
  fileKey: string;
  nodeId?: string;
  frameName?: string;
  suggestedScope: {
    kind: string;
    fileKey?: string;
    nodeId?: string;
    frameName?: string;
  };
};

type FigmaAuditWorkflowTabsProps = {
  disabled?: boolean;
  onSubmit: (payload: WorkflowSubmitPayload) => void;
  onParseUrl: (url: string) => Promise<ParsedFrameUrl>;
  onListPageFrames: (pageUrl: string) => Promise<ListPageFramesResponse>;
  /** Scroll the Figma Audit page content area when the list grows past the viewport. */
  onRequestScrollToBottom?: () => void;
};

const EMPTY_MANUAL_STEP: ManualStepRow = { url: "" };

function useScrollContentToBottomOnListGrow(
  listLength: number,
  onRequestScrollToBottom?: () => void
) {
  const previousLengthRef = useRef(listLength);

  useEffect(() => {
    if (listLength > previousLengthRef.current) {
      onRequestScrollToBottom?.();
    }

    previousLengthRef.current = listLength;
  }, [listLength, onRequestScrollToBottom]);
}

function parseFigmaFileKey(url: string): string | null {
  const match = url.match(/figma\.com\/design\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function formatWorkflowFrameLabel(name: string): string {
  return name
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function looksLikeFigmaFrameUrl(url: string): boolean {
  const trimmed = url.trim();

  if (!/figma\.com\/design\//i.test(trimmed)) {
    return false;
  }

  try {
    return Boolean(new URL(trimmed).searchParams.get("node-id"));
  } catch {
    return false;
  }
}

export function frameNameFromParsedUrl(parsed: ParsedFrameUrl): string | undefined {
  if (parsed.frameName) {
    return parsed.frameName;
  }

  if (parsed.suggestedScope.kind === "frame" && parsed.suggestedScope.frameName) {
    return parsed.suggestedScope.frameName;
  }

  return undefined;
}

export function manualStepLabel(index: number, row: ManualStepRow): string {
  const base = `Step ${index + 1}`;

  if (row.detecting) {
    return `${base} - …`;
  }

  if (row.frameName) {
    return `${base} - ${formatWorkflowFrameLabel(row.frameName)}`;
  }

  return base;
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

function isWorkflowInputMethod(value: string | null): value is WorkflowInputMethod {
  return value === "manual" || value === "page";
}

export function FigmaAuditWorkflowTabs({
  disabled,
  onSubmit,
  onParseUrl,
  onListPageFrames,
  onRequestScrollToBottom
}: FigmaAuditWorkflowTabsProps) {
  const [method, setMethod] = useState<WorkflowInputMethod>("manual");
  const [manualRows, setManualRows] = useState<ManualStepRow[]>([
    { ...EMPTY_MANUAL_STEP },
    { ...EMPTY_MANUAL_STEP }
  ]);
  const [pageUrl, setPageUrl] = useState("");
  const [detectedFrames, setDetectedFrames] = useState<WorkflowFrame[]>([]);
  const [detectedFileKey, setDetectedFileKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const controlsDisabled = disabled || pageLoading || manualSubmitting;

  useScrollContentToBottomOnListGrow(manualRows.length, onRequestScrollToBottom);
  useScrollContentToBottomOnListGrow(detectedFrames.length, onRequestScrollToBottom);

  const manualRowUrlKey = manualRows.map((row) => row.url).join("|");

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    manualRows.forEach((row, index) => {
      const trimmed = row.url.trim();

      if (!looksLikeFigmaFrameUrl(trimmed) || row.detecting) {
        return;
      }

      if (row.frameName) {
        return;
      }

      const timeout = setTimeout(() => {
        const urlAtDetect = trimmed;

        setManualRows((current) => {
          if (current[index]?.url.trim() !== urlAtDetect) {
            return current;
          }

          const next = [...current];
          next[index] = { url: urlAtDetect, detecting: true };
          return next;
        });

        void onParseUrl(urlAtDetect)
          .then((parsed) => {
            const frameName = frameNameFromParsedUrl(parsed);

            setManualRows((current) => {
              if (current[index]?.url.trim() !== urlAtDetect) {
                return current;
              }

              const next = [...current];
              next[index] = { url: urlAtDetect, frameName, detecting: false };
              return next;
            });
          })
          .catch(() => {
            setManualRows((current) => {
              if (current[index]?.url.trim() !== urlAtDetect) {
                return current;
              }

              const next = [...current];
              next[index] = { url: urlAtDetect, detecting: false };
              return next;
            });
          });
      }, 400);

      timeouts.push(timeout);
    });

    return () => {
      for (const timeout of timeouts) {
        clearTimeout(timeout);
      }
    };
  }, [manualRowUrlKey, manualRows, onParseUrl]); // manualRows: frameName/detecting skip guards

  function clearDetectedWorkflow() {
    setDetectedFrames([]);
    setDetectedFileKey(null);
    setError(null);
  }

  function moveDetectedFrame(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= detectedFrames.length) {
      return;
    }

    setDetectedFrames((current) => reorderFrames(current, index, nextIndex));
  }

  function moveManualRow(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= manualRows.length) {
      return;
    }

    setManualRows((current) => {
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, row ?? { ...EMPTY_MANUAL_STEP });
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
        urls: manualRows.map((row) => row.url),
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
    <Tabs
      value={method}
      onValueChange={(next) => {
        if (!isWorkflowInputMethod(next) || next === method) {
          return;
        }

        setMethod(next);
        setError(null);
      }}
      className="figma-audit-workflow-method-tabs writer-minimal-tabs flex w-full flex-col gap-4"
    >
      <WriterMinimalTabsList>
        <TabsTrigger
          value="manual"
          disabled={controlsDisabled}
          className={WRITER_MINIMAL_TAB_TRIGGER_CLASS}
        >
          Page by Page
        </TabsTrigger>
        <TabsTrigger
          value="page"
          disabled={controlsDisabled}
          className={WRITER_MINIMAL_TAB_TRIGGER_CLASS}
        >
          All in one
        </TabsTrigger>
      </WriterMinimalTabsList>

      <TabsContent value="manual" keepMounted className="mt-0 flex flex-col gap-4 outline-none">
          {manualRows.map((row, index) => (
            <div key={`manual-step-${index}`} className="flex flex-col gap-2">
              <Label
                htmlFor={`figma-workflow-step-${index}`}
                className="writer-home-text text-sm text-[#e5f1ff]/80"
              >
                {manualStepLabel(index, row)}
              </Label>
              <div className="flex min-w-0 items-center gap-3">
                <WriterFormInput
                  id={`figma-workflow-step-${index}`}
                  type="url"
                  shellClassName="writer-workflow-input-shell min-w-0 flex-1"
                  value={row.url}
                  disabled={controlsDisabled}
                  placeholder="https://www.figma.com/design/..."
                  onChange={(event) => {
                    const url = event.target.value;
                    setManualRows((current) => {
                      const next = [...current];
                      next[index] = { url };
                      return next;
                    });
                  }}
                />
                <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="writer-pill-ghost writer-pill-ghost--icon writer-workflow-reorder-btn shrink-0 border border-white/20"
                  disabled={controlsDisabled || index === 0}
                  aria-label={`Move step ${index + 1} up`}
                  onClick={() => moveManualRow(index, -1)}
                >
                  <ChevronUp className="size-4" strokeWidth={1.5} aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="writer-pill-ghost writer-pill-ghost--icon writer-workflow-reorder-btn shrink-0 border border-white/20"
                  disabled={controlsDisabled || index === manualRows.length - 1}
                  aria-label={`Move step ${index + 1} down`}
                  onClick={() => moveManualRow(index, 1)}
                >
                  <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden />
                </Button>
                </div>
              </div>
            </div>
          ))}

          <div className="figma-audit-workflow-footer flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="writer-pill-ghost writer-pill-add"
              disabled={controlsDisabled}
              onClick={() => setManualRows((current) => [...current, { ...EMPTY_MANUAL_STEP }])}
            >
              <Plus className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
              <span>Add step</span>
            </Button>
            <WriterPrimaryButton
              type="button"
              disabled={controlsDisabled}
              onClick={() => void submitManual()}
            >
              {manualSubmitting ? "Starting…" : "Start audit"}
            </WriterPrimaryButton>
          </div>
      </TabsContent>

      <TabsContent value="page" keepMounted className="mt-0 flex flex-col gap-4 outline-none">
          {detectedFrames.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Label
                htmlFor="figma-workflow-page-url"
                className="writer-home-text text-sm text-[#e5f1ff]/80"
              >
                Page link
              </Label>
              <WriterFormInput
                id="figma-workflow-page-url"
                type="url"
                shellClassName="writer-workflow-input-shell min-w-0 flex-1"
                value={pageUrl}
                disabled={controlsDisabled}
                placeholder="https://www.figma.com/design/..."
                onChange={(event) => setPageUrl(event.target.value)}
              />
            </div>
          ) : null}

          {detectedFrames.length > 0
            ? detectedFrames.map((frame, index) => (
                <div key={`${frame.nodeId}-${index}`} className="flex flex-col gap-2">
                  <Label
                    htmlFor={`figma-workflow-frame-${index}`}
                    className="writer-home-text text-sm text-[#e5f1ff]/80"
                  >
                    {`Step ${index + 1}`}
                  </Label>
                  <div className="flex min-w-0 items-center gap-3">
                    <GlassCard
                      variant="outline"
                      className="writer-workflow-frame-row-shell min-w-0 flex-1"
                    >
                      <input
                        id={`figma-workflow-frame-${index}`}
                        type="checkbox"
                        checked={frame.checked}
                        disabled={controlsDisabled}
                        className="writer-workflow-frame-checkbox shrink-0"
                        onChange={(event) => {
                          setDetectedFrames((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, checked: event.target.checked } : item
                            )
                          );
                        }}
                      />
                      <p className="writer-home-text m-0 min-w-0 flex-1 truncate text-sm leading-tight text-[#e5f1ff]">
                        {formatWorkflowFrameLabel(frame.name)}
                      </p>
                    </GlassCard>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="writer-pill-ghost writer-pill-ghost--icon writer-workflow-reorder-btn shrink-0 border border-white/20"
                        disabled={controlsDisabled || index === 0}
                        aria-label={`Move step ${index + 1} up`}
                        onClick={() => moveDetectedFrame(index, -1)}
                      >
                        <ChevronUp className="size-4" strokeWidth={1.5} aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="writer-pill-ghost writer-pill-ghost--icon writer-workflow-reorder-btn shrink-0 border border-white/20"
                        disabled={controlsDisabled || index === detectedFrames.length - 1}
                        aria-label={`Move step ${index + 1} down`}
                        onClick={() => moveDetectedFrame(index, 1)}
                      >
                        <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            : null}

          <div className="figma-audit-workflow-footer flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            {detectedFrames.length > 0 ? (
              <Button
                type="button"
                variant="link"
                disabled={controlsDisabled}
                className="writer-home-text h-auto px-0 text-sm font-normal text-[#e5f1ff]/55 no-underline hover:text-[#ff9b9b] hover:no-underline disabled:opacity-40"
                onClick={clearDetectedWorkflow}
              >
                Delete workflow
              </Button>
            ) : null}
            {detectedFrames.length === 0 ? (
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
            ) : (
              <WriterPrimaryButton type="button" disabled={controlsDisabled} onClick={submitDetected}>
                Start audit
              </WriterPrimaryButton>
            )}
          </div>
      </TabsContent>

      {error ? (
        <InlineAlert kind="error" title="Workflow" subtitle={error} onClose={() => setError(null)} />
      ) : null}
    </Tabs>
  );
}
