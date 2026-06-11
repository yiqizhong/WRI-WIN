import { Frame, ListOrdered } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatProductDisplayName } from "@/lib/writer-product-display";
import { InlineAlert } from "@/components/writer/inline-alert";
import { GlassCard } from "@/components/writer/glass-card";
import {
  WriterFormField,
  WriterFormInput,
  WriterFormSelect,
  WriterFormTextarea
} from "@/components/writer/writer-form-field";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import type { CreateFigmaSessionInput, FigmaAuditMode } from "@writer/contracts";

import { FigmaAuditWorkflowTabs, type WorkflowSubmitPayload } from "../figma-audit-workflow-tabs";
import { DaemonClientError } from "../daemon-client";
import { syncScrollEdgeMask } from "../lib/sync-scroll-edge-mask";
import { WorkflowGlassPanel, WorkflowScreenShell } from "../layout/workflow-screen-shell";
import { useWorkspace } from "../workspace-context";
import { isFigmaMcpConnected } from "../agents-runtime";

const NONE_PRODUCT = "__none__";

type FigmaAuditLayoutPhase = "default" | "split";

/** Workflow / Frame panel visibility lag after session resize begins */
const FIGMA_AUDIT_FRAME_VISIBLE_DELAY_MS = 100;

const AUDIT_MODE_OPTIONS = [
  { value: "single_frame" as const, label: "Single frame", icon: Frame },
  { value: "workflow" as const, label: "Workflow", icon: ListOrdered }
];

function AuditModeChoice({
  mode,
  disabled,
  onChange
}: {
  mode: FigmaAuditMode | null;
  disabled?: boolean;
  onChange: (mode: FigmaAuditMode) => void;
}) {
  return (
    <fieldset className="m-0 flex w-full min-w-0 flex-row gap-2 border-0 p-0">
      <legend className="sr-only">Audit type</legend>
      {AUDIT_MODE_OPTIONS.map((option) => {
        const isSelected = mode === option.value;
        const inputId = `figma-audit-mode-${option.value}`;
        const Icon = option.icon;

        return (
          <GlassCard
            key={option.value}
            variant="outline"
            selected={isSelected}
            className="writer-agent-tile flex min-h-0 min-w-0 flex-1 basis-0 flex-col justify-center p-3"
            onClick={disabled ? undefined : () => onChange(option.value)}
          >
            <div className="flex w-full min-w-0 items-center gap-2">
              <input
                type="radio"
                id={inputId}
                name="figma-audit-mode"
                value={option.value}
                checked={isSelected}
                disabled={disabled}
                className="writer-accent-radio shrink-0"
                onChange={() => onChange(option.value)}
                onClick={(event) => event.stopPropagation()}
              />
              <Icon className="size-4 shrink-0 text-[#e5f1ff]/70" strokeWidth={1.25} aria-hidden />
              <Label
                htmlFor={inputId}
                className="min-w-0 flex-1 truncate text-base font-normal leading-tight tracking-normal text-[#e5f1ff]/88"
              >
                {option.label}
              </Label>
            </div>
          </GlassCard>
        );
      })}
    </fieldset>
  );
}

function formatAuditProductLabel(
  productId: string,
  products: { id: string }[]
): string {
  if (productId === NONE_PRODUCT) {
    return "General purpose";
  }

  const product = products.find((entry) => entry.id === productId);
  return product ? formatProductDisplayName(product.id) : "Select product";
}

export function FigmaAuditScreen() {
  const navigate = useNavigate();
  const {
    daemonClient,
    daemonConnected,
    workspaceReady,
    workspaceProjectId,
    products,
    setSelectedProductId,
    mcpServers,
    mcpLoadState
  } = useWorkspace();

  const [productId, setProductId] = useState<string>(NONE_PRODUCT);
  const [featureName, setFeatureName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<FigmaAuditMode | null>(null);
  const [frameLayoutOpen, setFrameLayoutOpen] = useState(false);
  const [layoutPhase, setLayoutPhase] = useState<FigmaAuditLayoutPhase>("default");
  const layoutSplit = layoutPhase === "split";
  const framePanelVisible = frameLayoutOpen && layoutSplit;
  const frameVisibleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [frameUrl, setFrameUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !workspaceReady || !daemonConnected || submitting;
  const singleFrameSubmitReady = frameUrl.trim().length > 0;
  const showFigmaMcpAlert =
    daemonConnected && mcpLoadState === "ready" && !isFigmaMcpConnected(mcpServers);
  const showBlockingAlert = !daemonConnected || showFigmaMcpAlert;

  const scrollPageContentToBottom = useCallback(() => {
    const scrollEl = contentScrollRef.current;
    if (!scrollEl) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const { scrollHeight, clientHeight } = scrollEl;
        if (scrollHeight <= clientHeight) {
          return;
        }

        scrollEl.scrollTo({ top: scrollHeight, behavior: "smooth" });
        syncScrollEdgeMask(scrollEl);
      });
    });
  }, []);

  useEffect(() => {
    const scrollEl = contentScrollRef.current;
    if (!scrollEl) {
      return;
    }

    const onScroll = () => syncScrollEdgeMask(scrollEl);

    onScroll();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(onScroll);
    resizeObserver.observe(scrollEl);

    const mutationObserver = new MutationObserver(onScroll);
    mutationObserver.observe(scrollEl, { childList: true, subtree: true });

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [layoutSplit, framePanelVisible, mode]);

  useEffect(() => {
    return () => {
      if (frameVisibleTimeoutRef.current) {
        clearTimeout(frameVisibleTimeoutRef.current);
      }
    };
  }, []);

  function clearFrameVisibleTimeout() {
    if (frameVisibleTimeoutRef.current) {
      clearTimeout(frameVisibleTimeoutRef.current);
      frameVisibleTimeoutRef.current = null;
    }
  }

  function handleAuditModeChange(nextMode: FigmaAuditMode) {
    clearFrameVisibleTimeout();
    setMode(nextMode);

    if (layoutPhase === "split" && frameLayoutOpen) {
      return;
    }

    setFrameLayoutOpen(false);
    setLayoutPhase("default");

    // Session resize starts on split; workflow panel becomes visible after a short delay.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setLayoutPhase("split");
        frameVisibleTimeoutRef.current = setTimeout(() => {
          setFrameLayoutOpen(true);
          frameVisibleTimeoutRef.current = null;
        }, FIGMA_AUDIT_FRAME_VISIBLE_DELAY_MS);
      });
    });
  }

  const auditProductLabel = formatAuditProductLabel(productId, products);
  const auditProductOptions = [
    { value: NONE_PRODUCT, label: "General purpose" },
    ...products.map((product) => ({
      value: product.id,
      label: formatProductDisplayName(product.id)
    }))
  ];

  async function startAudit(input: CreateFigmaSessionInput) {
    if (!workspaceProjectId) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (productId !== NONE_PRODUCT) {
        await setSelectedProductId(productId);
      }

      const session = await daemonClient.createFigmaSession(input);
      navigate("/audits");
      setSubmitting(false);

      void daemonClient.runAudit(session.id).catch((auditError) => {
        console.error(
          auditError instanceof Error ? auditError.message : "Figma audit run failed after navigation."
        );
      });
    } catch (submitError) {
      setError(submitError instanceof DaemonClientError ? submitError.message : "Could not start Figma audit.");
      setSubmitting(false);
    }
  }

  async function submitSingleFrame() {
    const trimmedFeatureName = featureName.trim();
    const trimmedDescription = description.trim();

    if (!workspaceProjectId || !trimmedFeatureName || !trimmedDescription || !frameUrl.trim()) {
      setError("Feature name, feature description, and frame URL are required.");
      return;
    }

    await startAudit({
      mode: "single_frame",
      projectId: workspaceProjectId,
      productId: productId === NONE_PRODUCT ? undefined : productId,
      featureName: trimmedFeatureName,
      description: trimmedDescription,
      url: frameUrl.trim()
    });
  }

  async function submitWorkflow(payload: WorkflowSubmitPayload) {
    const trimmedFeatureName = featureName.trim();
    const trimmedDescription = description.trim();

    if (!workspaceProjectId || !trimmedFeatureName || !trimmedDescription) {
      setError("Feature name and feature description are required.");
      return;
    }

    await startAudit({
      mode: "workflow",
      projectId: workspaceProjectId,
      productId: productId === NONE_PRODUCT ? undefined : productId,
      featureName: trimmedFeatureName,
      description: trimmedDescription,
      fileKey: payload.fileKey,
      nodeIds: payload.nodeIds,
      nodeNames: payload.nodeNames,
      url: payload.url
    });
  }

  return (
    <div className="figma-audit-page flex h-full min-h-0 flex-col overflow-hidden">
      <WriterPageSubheader
        title="Figma Audit"
        backTo="/"
        backLabel="Return to home"
        trailing={
          <Button
            variant="ghost"
            className="writer-pill-ghost writer-pill-add"
            render={<Link to="/audits" className="no-underline hover:no-underline" />}
          >
            View Audits Log
          </Button>
        }
      />

      <div className="writer-page-content-inset writer-content-fade-in flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="writer-chat-scroll-region relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            ref={contentScrollRef}
            className="writer-chat-scroll figma-audit-content-scroll h-full min-h-0"
          >
            <WorkflowScreenShell className="writer-page-subheader-content-gap overflow-visible pb-0">
              <div className={cn("figma-audit-stage", layoutSplit && "figma-audit-stage--split")}>
                <div className="figma-audit-session-slot flex flex-col gap-4">
                  {!daemonConnected ? (
                    <InlineAlert
                      kind="warning"
                      title="Daemon disconnected"
                      subtitle="Start the Writer daemon before creating a Figma audit session."
                    />
                  ) : showFigmaMcpAlert ? (
                    <InlineAlert
                      kind="warning"
                      title="Figma not connected"
                      subtitle="Turn on the Figma MCP in Settings to run an audit."
                    />
                  ) : null}

                  <div className={cn("flex flex-col gap-4", showBlockingAlert && "pointer-events-none opacity-40 select-none")}>
                    {error ? (
                      <InlineAlert
                        kind="error"
                        title="Audit error"
                        subtitle={error}
                        onClose={() => setError(null)}
                      />
                    ) : null}

                    <WorkflowGlassPanel title="Session">
                      <div className="flex flex-col gap-4">
                        <WriterFormField label="Audit product (optional)" htmlFor="figma-product">
                          <WriterFormSelect
                            id="figma-product"
                            value={productId}
                            options={auditProductOptions}
                            displayValue={auditProductLabel}
                            placeholder="Select product"
                            disabled={disabled}
                            onValueChange={(value) => setProductId(value)}
                          />
                        </WriterFormField>

                        <WriterFormField label="Feature name" htmlFor="figma-feature">
                          <WriterFormInput
                            id="figma-feature"
                            value={featureName}
                            disabled={disabled}
                            placeholder="e.g. Checkout confirmation"
                            onChange={(event) => setFeatureName(event.target.value)}
                          />
                        </WriterFormField>

                        <WriterFormField label="Feature description" htmlFor="figma-description">
                          <WriterFormTextarea
                            id="figma-description"
                            value={description}
                            disabled={disabled}
                            rows={4}
                            placeholder="e.g. Post-purchase confirmation and order summary screens…"
                            onChange={(event) => setDescription(event.target.value)}
                          />
                        </WriterFormField>

                        <WriterFormField label="Audit type">
                          <AuditModeChoice mode={mode} disabled={disabled} onChange={handleAuditModeChange} />
                        </WriterFormField>
                      </div>
                    </WorkflowGlassPanel>
                  </div>
                </div>

                {framePanelVisible ? (
                  <Fragment>
                    <div
                      role="presentation"
                      aria-hidden
                      className="figma-audit-stage-divider writer-home-divider-vertical"
                    />

                    <div className="figma-audit-frame-rail figma-audit-frame-rail--visible">
                      <div className="figma-audit-frame-slot">
                        <WorkflowGlassPanel
                          title={mode === "workflow" ? "Workflow" : "Single frame"}
                          fillHeight={mode !== "workflow"}
                        >
                          {mode !== "workflow" ? (
                            <div className="flex min-h-0 flex-1 flex-col gap-4">
                              <WriterFormField label="Frame URL" htmlFor="figma-frame-url">
                                <WriterFormInput
                                  id="figma-frame-url"
                                  type="url"
                                  value={frameUrl}
                                  disabled={disabled}
                                  placeholder="https://www.figma.com/design/..."
                                  onChange={(event) => setFrameUrl(event.target.value)}
                                />
                              </WriterFormField>
                              <div className="mt-auto flex justify-end">
                                <WriterPrimaryButton
                                  type="button"
                                  disabled={disabled || !singleFrameSubmitReady}
                                  onClick={() => void submitSingleFrame()}
                                >
                                  {submitting ? "Starting…" : "Start audit"}
                                </WriterPrimaryButton>
                              </div>
                            </div>
                          ) : (
                            <FigmaAuditWorkflowTabs
                              disabled={disabled}
                              onParseUrl={(url) => daemonClient.parseFigmaUrl(url)}
                              onListPageFrames={(pageUrl) => daemonClient.listPageFrames(pageUrl)}
                              onSubmit={(payload) => void submitWorkflow(payload)}
                              onRequestScrollToBottom={scrollPageContentToBottom}
                            />
                          )}
                        </WorkflowGlassPanel>
                      </div>
                    </div>
                  </Fragment>
                ) : null}
              </div>
            </WorkflowScreenShell>
          </div>
        </div>
      </div>
    </div>
  );
}
