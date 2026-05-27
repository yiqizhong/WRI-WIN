import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { formatProductDisplayName } from "@/lib/writer-product-display";
import { InlineAlert } from "@/components/writer/inline-alert";
import {
  WRITER_MINIMAL_TAB_TRIGGER_CLASS,
  WriterMinimalTabsList
} from "@/components/writer/writer-minimal-tabs";
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
import { WorkflowGlassPanel, WorkflowScreenShell } from "../layout/workflow-screen-shell";
import { WriterPageGrid, WriterPageGridHalf } from "../layout/writer-grid";
import { useWorkspace } from "../workspace-context";

const NONE_PRODUCT = "__none__";

function isFigmaAuditMode(value: string): value is FigmaAuditMode {
  return value === "single_frame" || value === "workflow";
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
          <Button
            variant="ghost"
            className="writer-pill-ghost writer-pill-add"
            render={<Link to="/audits" className="no-underline hover:no-underline" />}
          >
            View Audits Log
          </Button>
        }
      />

      <div className="writer-page-content-inset flex min-h-0 flex-1 flex-col">
        <WorkflowScreenShell className="writer-page-subheader-content-gap min-h-0 flex-1">
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

          <WriterPageGrid className="w-full grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start lg:gap-x-14 lg:gap-y-8">
            <WriterPageGridHalf>
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
                      variant="title"
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
                </div>
              </WorkflowGlassPanel>
            </WriterPageGridHalf>

            <div
              role="presentation"
              aria-hidden
              className="writer-home-divider-vertical hidden justify-self-center self-start lg:block"
            />

            <WriterPageGridHalf>
              <WorkflowGlassPanel className="writer-minimal-tabs w-full">
                <Tabs
                  value={mode}
                  onValueChange={(next) => {
                    if (next && isFigmaAuditMode(next)) {
                      setMode(next);
                    }
                  }}
                  className="flex w-full flex-col gap-6"
                >
                  <WriterMinimalTabsList>
                    <TabsTrigger value="single_frame" className={WRITER_MINIMAL_TAB_TRIGGER_CLASS}>
                      Single frame
                    </TabsTrigger>
                    <TabsTrigger value="workflow" className={WRITER_MINIMAL_TAB_TRIGGER_CLASS}>
                      Workflow
                    </TabsTrigger>
                  </WriterMinimalTabsList>

                  <TabsContent
                    value="single_frame"
                    className="flex w-full flex-col gap-4 data-[hidden]:hidden"
                  >
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
                    <WriterPrimaryButton
                      type="button"
                      disabled={disabled}
                      onClick={() => void submitSingleFrame()}
                    >
                      {submitting ? "Starting…" : "Start audit"}
                    </WriterPrimaryButton>
                  </TabsContent>

                  <TabsContent
                    value="workflow"
                    className="flex w-full flex-col data-[hidden]:hidden"
                  >
                    <FigmaAuditWorkflowTabs
                      disabled={disabled}
                      onParseUrl={(url) => daemonClient.parseFigmaUrl(url)}
                      onListPageFrames={(pageUrl) => daemonClient.listPageFrames(pageUrl)}
                      onSubmit={(payload) => void submitWorkflow(payload)}
                    />
                  </TabsContent>
                </Tabs>
              </WorkflowGlassPanel>
            </WriterPageGridHalf>
          </WriterPageGrid>
        </WorkflowScreenShell>
      </div>
    </div>
  );
}
