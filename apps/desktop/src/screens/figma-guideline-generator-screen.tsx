import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const PRODUCT_NAME_PLACEHOLDERS = ["DDPM", "UUE", "DAMA", "DDMC", "AWCC"] as const;
const PRODUCT_NAME_PLACEHOLDER_INTERVAL_MS = 2000;

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterFormField, WriterFormInput } from "@/components/writer/writer-form-field";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { ZodError } from "zod";

import { DaemonClientError } from "../daemon-client";
import { WorkflowGlassPanel, WorkflowScreenShell } from "../layout/workflow-screen-shell";
import { useWorkspace } from "../workspace-context";

export function FigmaGuidelineGeneratorScreen() {
  const navigate = useNavigate();
  const { daemonClient, daemonConnected, workspaceReady, workspaceProjectId, runGuidelineGeneration } =
    useWorkspace();
  const [productName, setProductName] = useState("");
  const [productNamePlaceholderIndex, setProductNamePlaceholderIndex] = useState(0);
  const [figmaUrl, setFigmaUrl] = useState("");

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setProductNamePlaceholderIndex((index) => (index + 1) % PRODUCT_NAME_PLACEHOLDERS.length);
    }, PRODUCT_NAME_PLACEHOLDER_INTERVAL_MS);
    return () => window.clearInterval(timerId);
  }, []);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedProductName = productName.trim();
  const canSubmit =
    daemonConnected &&
    workspaceReady &&
    Boolean(workspaceProjectId) &&
    trimmedProductName.length > 0 &&
    figmaUrl.trim().length > 0 &&
    !starting;

  async function handleGenerate() {
    if (!canSubmit || !workspaceProjectId) return;
    setStarting(true);
    setError(null);

    try {
      const session = await daemonClient.createFigmaSession({
        projectId: workspaceProjectId,
        mode: "single_frame",
        url: figmaUrl.trim(),
        featureName: trimmedProductName,
        description: `Writing guidelines for ${trimmedProductName}.`
      });

      // Start the daemon request before navigation so the run is not dropped on route change.
      const generationTask = runGuidelineGeneration(session.id);

      navigate("/guide/log");
      setStarting(false);

      void generationTask;
    } catch (err) {
      const message =
        err instanceof DaemonClientError
          ? err.message
          : err instanceof ZodError
            ? "The daemon returned an unexpected response. Quit Writer (Cmd+Q) and reopen the app, then try again."
            : err instanceof Error
              ? err.message
              : "Could not start guideline generation.";
      setError(message);
      setStarting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <WriterPageSubheader
        title="Generate writing guidelines"
        backTo="/"
        backLabel="Return to home"
        trailing={
          <Button
            variant="ghost"
            className="writer-pill-ghost writer-pill-add"
            render={<Link to="/guide/log" className="no-underline hover:no-underline" />}
          >
            View Guidelines Log
          </Button>
        }
      />

      <div className="writer-page-content-inset writer-content-fade-in flex min-h-0 flex-1 flex-col overflow-hidden">
        <WorkflowScreenShell className="writer-page-subheader-content-gap min-h-0 flex-1 overflow-y-auto pb-5">
          <p className="writer-home-section-description max-w-2xl">
            Generate background, glossary, and writing-guide files from Figma. After you start a run, progress
            appears in the Guidelines Log (often 3–8 minutes with Devin).
          </p>

          <WriterFormField label="Product name" htmlFor="guide-product-name">
            <WriterFormInput
              id="guide-product-name"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder={PRODUCT_NAME_PLACEHOLDERS[productNamePlaceholderIndex]}
              disabled={starting}
            />
          </WriterFormField>

          {!daemonConnected ? (
            <InlineAlert
              kind="warning"
              title="Daemon unavailable"
              subtitle="Reconnect to Writer's local service before generating guidelines."
            />
          ) : null}

          {error ? (
            <InlineAlert kind="error" title="Request failed" subtitle={error} onClose={() => setError(null)} />
          ) : null}

          <WorkflowGlassPanel title="Figma source">
            <div className="grid gap-4">
              <WriterFormField label="Figma frame URL" htmlFor="guide-figma-url">
                <WriterFormInput
                  id="guide-figma-url"
                  value={figmaUrl}
                  onChange={(event) => setFigmaUrl(event.target.value)}
                  placeholder="https://www.figma.com/design/..."
                  disabled={starting}
                />
              </WriterFormField>
              <div className="flex justify-end">
                <WriterPrimaryButton disabled={!canSubmit} onClick={() => void handleGenerate()}>
                  {starting ? "Starting…" : "Generate starter pack"}
                </WriterPrimaryButton>
              </div>
            </div>
          </WorkflowGlassPanel>
        </WorkflowScreenShell>
      </div>
    </div>
  );
}
