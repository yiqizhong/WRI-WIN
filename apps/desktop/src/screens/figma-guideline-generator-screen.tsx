import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";

const PRODUCT_NAME_PLACEHOLDERS = ["DDPM", "UUE", "DAMA", "DDMC", "AWCC"] as const;
const PRODUCT_NAME_PLACEHOLDER_INTERVAL_MS = 2000;

import { InlineAlert } from "@/components/writer/inline-alert";
import { WriterFormField, WriterFormInput } from "@/components/writer/writer-form-field";
import { WriterPageSubheader } from "@/components/writer/writer-page-subheader";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { downloadTextFile } from "@/lib/download-text-file";
import { ZodError } from "zod";
import type { FigmaGuidelineGeneratedFile, FigmaGuidelineGenerationResponse } from "@writer/contracts";

import { DaemonClientError } from "../daemon-client";
import {
  guidelineGenerationAlertKind,
  guidelineGenerationUiState
} from "../figma-guideline-generation-diagnostics";
import { WorkflowGlassPanel, WorkflowScreenShell } from "../layout/workflow-screen-shell";
import { useWorkspace } from "../workspace-context";

export function FigmaGuidelineGeneratorScreen() {
  const { daemonClient, daemonConnected, workspaceReady, workspaceProjectId } = useWorkspace();
  const [productName, setProductName] = useState("");
  const [productNamePlaceholderIndex, setProductNamePlaceholderIndex] = useState(0);
  const [figmaUrl, setFigmaUrl] = useState("");

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setProductNamePlaceholderIndex((index) => (index + 1) % PRODUCT_NAME_PLACEHOLDERS.length);
    }, PRODUCT_NAME_PLACEHOLDER_INTERVAL_MS);
    return () => window.clearInterval(timerId);
  }, []);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FigmaGuidelineGenerationResponse | null>(null);

  const uiState = guidelineGenerationUiState(result, generating);
  const trimmedProductName = productName.trim();
  const canSubmit =
    daemonConnected &&
    workspaceReady &&
    Boolean(workspaceProjectId) &&
    trimmedProductName.length > 0 &&
    figmaUrl.trim().length > 0 &&
    !generating;

  async function handleGenerate() {
    if (!canSubmit || !workspaceProjectId) return;
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const session = await daemonClient.createFigmaSession({
        projectId: workspaceProjectId,
        mode: "single_frame",
        url: figmaUrl.trim(),
        featureName: trimmedProductName,
        description: `Writing guidelines for ${trimmedProductName}.`
      });
      const generation = await daemonClient.generateFigmaGuideline({
        sessionId: session.id,
        maxCandidates: 500
      });
      setResult(generation);
    } catch (err) {
      const message =
        err instanceof DaemonClientError
          ? err.message
          : err instanceof ZodError
            ? "The daemon returned an unexpected response. Quit Writer (Cmd+Q) and reopen the app, then try again."
            : err instanceof Error &&
                (err.name === "AbortError" || /signal is aborted/i.test(err.message))
              ? "The request was cancelled before it finished. Guideline generation with Devin can take several minutes — keep this screen open and try again."
              : err instanceof Error
                ? err.message
                : "Guideline generation failed.";
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  function downloadFile(file: FigmaGuidelineGeneratedFile) {
    downloadTextFile(file.name, file.mimeType, file.content);
  }

  function downloadAll() {
    for (const file of result?.files ?? []) {
      downloadFile(file);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <WriterPageSubheader
        title="Generate writing guidelines"
        backTo="/"
        backLabel="Return to home"
      />

      <div className="writer-page-content-inset writer-content-fade-in flex min-h-0 flex-1 flex-col overflow-hidden">
        <WorkflowScreenShell className="writer-page-subheader-content-gap min-h-0 flex-1 overflow-y-auto pb-5">
          <p className="writer-home-section-description max-w-2xl">
            Generate background, glossary, and writing-guide files from Figma.
          </p>

          <WriterFormField label="Product name" htmlFor="guide-product-name">
            <WriterFormInput
              id="guide-product-name"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder={PRODUCT_NAME_PLACEHOLDERS[productNamePlaceholderIndex]}
              disabled={generating}
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

          {uiState.kind !== "idle" && uiState.kind !== "generating" ? (
            <InlineAlert
              kind={guidelineGenerationAlertKind(uiState)}
              title={uiState.title}
              subtitle={uiState.subtitle}
            />
          ) : null}

          {generating ? (
            <InlineAlert
              kind="info"
              title="Generating starter pack"
              subtitle="Extracting Figma copy, then running Devin (often 3–8 minutes). Keep this screen open."
            />
          ) : null}

          <WorkflowGlassPanel title="Figma source">
            <div className="grid gap-4">
              <WriterFormField label="Figma frame URL" htmlFor="guide-figma-url">
                <WriterFormInput
                  id="guide-figma-url"
                  value={figmaUrl}
                  onChange={(event) => setFigmaUrl(event.target.value)}
                  placeholder="https://www.figma.com/design/..."
                  disabled={generating}
                />
              </WriterFormField>
              <div className="flex justify-end">
                <WriterPrimaryButton disabled={!canSubmit} onClick={() => void handleGenerate()}>
                  Generate starter pack
                </WriterPrimaryButton>
              </div>
            </div>
          </WorkflowGlassPanel>

          {result?.ok && result.files ? (
            <WorkflowGlassPanel
              title="Downloads"
              description="Review and download each file. Upload refined versions in Settings → Writing Guidelines when ready."
              actions={
                <WriterPrimaryButton className="px-4" onClick={downloadAll}>
                  Download all
                </WriterPrimaryButton>
              }
            >
              <ul className="grid gap-2">
                {result.files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#e5f1ff]/10 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <BookOpen className="size-4 shrink-0 text-[#e5f1ff]/60" aria-hidden />
                      <span className="truncate text-sm text-[#e5f1ff]/88">{file.name}</span>
                    </div>
                    <WriterPrimaryButton className="px-3 py-2 text-sm" onClick={() => downloadFile(file)}>
                      Download
                    </WriterPrimaryButton>
                  </li>
                ))}
              </ul>
            </WorkflowGlassPanel>
          ) : null}
        </WorkflowScreenShell>
      </div>
    </div>
  );
}
