import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatProductDisplayName } from "@/lib/writer-product-display";
import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { cn } from "@/lib/utils";
import type { CreateFigmaSessionInput, FigmaAuditMode } from "@writer/contracts";

import { FigmaAuditWorkflowTabs, type WorkflowSubmitPayload } from "../figma-audit-workflow-tabs";
import { DaemonClientError } from "../daemon-client";
import { WorkflowGlassPanel, WorkflowScreenShell } from "../layout/workflow-screen-shell";
import { WriterPageGrid, WriterPageGridHalf } from "../layout/writer-grid";
import { useWorkspace } from "../workspace-context";

const NONE_PRODUCT = "__none__";

export function FigmaAuditScreen() {
  const navigate = useNavigate();
  const {
    daemonClient,
    daemonConnected,
    workspaceReady,
    workspaceProjectId,
    products,
    setSelectedProductId
  } = useWorkspace();

  const [productId, setProductId] = useState<string>(NONE_PRODUCT);
  const [featureName, setFeatureName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<FigmaAuditMode>("single_frame");
  const [frameUrl, setFrameUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !workspaceReady || !daemonConnected || submitting;

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
      const audit = await daemonClient.runAudit(session.id);

      if (audit.diagnostic) {
        setError(audit.diagnostic.message);
        navigate(`/audits/${session.id}`);
        return;
      }

      navigate(`/audits/${session.id}`);
    } catch (submitError) {
      setError(submitError instanceof DaemonClientError ? submitError.message : "Could not start Figma audit.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSingleFrame() {
    if (!workspaceProjectId || !featureName.trim() || !description.trim() || !frameUrl.trim()) {
      setError("Feature name, description, and frame URL are required.");
      return;
    }

    await startAudit({
      mode: "single_frame",
      projectId: workspaceProjectId,
      productId: productId === NONE_PRODUCT ? undefined : productId,
      featureName: featureName.trim(),
      description: description.trim(),
      url: frameUrl.trim()
    });
  }

  async function submitWorkflow(payload: WorkflowSubmitPayload) {
    if (!workspaceProjectId || !featureName.trim() || !description.trim()) {
      setError("Feature name and description are required.");
      return;
    }

    await startAudit({
      mode: "workflow",
      projectId: workspaceProjectId,
      productId: productId === NONE_PRODUCT ? undefined : productId,
      featureName: featureName.trim(),
      description: description.trim(),
      fileKey: payload.fileKey,
      nodeIds: payload.nodeIds
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <WriterPageSubheader
        title="Figma Audit"
        backTo="/"
        backLabel="Return to home"
        trailing={
          <Link
            to="/audits"
            className={cn(
              "writer-pill-ghost writer-pill-ghost--accent",
              "inline-flex h-auto items-center no-underline hover:no-underline"
            )}
          >
            View audits
          </Link>
        }
      />

      <WorkflowScreenShell className="min-h-0 flex-1">
        <p className="writer-type-body-compact m-0 max-w-2xl text-[#e5f1ff]/70">
          Review UX copy in Figma frames against your guideline stack, then write approved edits back.
        </p>

      {!daemonConnected ? (
        <InlineAlert
          kind="warning"
          title="Daemon disconnected"
          subtitle="Start the Writer daemon before creating a Figma audit session."
        />
      ) : null}

      {error ? (
        <InlineAlert kind="error" title="Audit error" subtitle={error} onClose={() => setError(null)} />
      ) : null}

      <WriterPageGrid className="w-full grid-cols-1 auto-rows-min gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-8">
        <WriterPageGridHalf>
          <WorkflowGlassPanel title="Session" description="Product context and feature metadata for this audit run.">
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="figma-product" className="writer-home-text text-sm text-[#e5f1ff]/80">
                  Product (optional)
                </Label>
                <Select
                  value={productId}
                  onValueChange={(value) => setProductId(value ?? NONE_PRODUCT)}
                  disabled={disabled}
                >
                  <SelectTrigger id="figma-product">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_PRODUCT}>(none)</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {formatProductDisplayName(product.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="figma-feature" className="writer-home-text text-sm text-[#e5f1ff]/80">
                  Feature name
                </Label>
                <Input
                  id="figma-feature"
                  value={featureName}
                  disabled={disabled}
                  onChange={(event) => setFeatureName(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="figma-description" className="writer-home-text text-sm text-[#e5f1ff]/80">
                  Description
                </Label>
                <Textarea
                  id="figma-description"
                  value={description}
                  disabled={disabled}
                  rows={4}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={mode === "single_frame" ? "default" : "secondary"}
                  disabled={disabled}
                  onClick={() => setMode("single_frame")}
                >
                  Single frame
                </Button>
                <Button
                  type="button"
                  variant={mode === "workflow" ? "default" : "secondary"}
                  disabled={disabled}
                  onClick={() => setMode("workflow")}
                >
                  Workflow
                </Button>
              </div>
            </div>
          </WorkflowGlassPanel>
        </WriterPageGridHalf>

        <div
          role="presentation"
          aria-hidden
          className="writer-home-divider-vertical hidden justify-self-center self-start lg:block"
        />

        <WriterPageGridHalf fillHeight>
          <WorkflowGlassPanel
            fillHeight
            title={mode === "single_frame" ? "Frame" : "Workflow"}
            description={
              mode === "single_frame"
                ? "Paste a single Figma frame URL to audit."
                : "Paste frame links in order, or browse a page to pick frames."
            }
            className="min-h-[320px]"
          >
            {mode === "single_frame" ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="figma-frame-url" className="writer-home-text text-sm text-[#e5f1ff]/80">
                    Frame URL
                  </Label>
                  <Input
                    id="figma-frame-url"
                    value={frameUrl}
                    disabled={disabled}
                    placeholder="https://www.figma.com/design/..."
                    onChange={(event) => setFrameUrl(event.target.value)}
                  />
                </div>
                <WriterPrimaryButton
                  type="button"
                  disabled={disabled}
                  onClick={() => void submitSingleFrame()}
                >
                  {submitting ? "Starting…" : "Start audit"}
                </WriterPrimaryButton>
              </div>
            ) : (
              <FigmaAuditWorkflowTabs
                disabled={disabled}
                onParseUrl={(url) => daemonClient.parseFigmaUrl(url)}
                onListPageFrames={(pageUrl) => daemonClient.listPageFrames(pageUrl)}
                onSubmit={(payload) => void submitWorkflow(payload)}
              />
            )}
          </WorkflowGlassPanel>
        </WriterPageGridHalf>
      </WriterPageGrid>
      </WorkflowScreenShell>
    </div>
  );
}
