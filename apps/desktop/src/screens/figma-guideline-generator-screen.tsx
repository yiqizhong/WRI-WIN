import { BookOpen } from "lucide-react";
import { useState } from "react";

import { InlineAlert } from "@/components/writer/inline-alert";
import {
  WriterFormField,
  WriterFormInput,
  WriterFormTextarea
} from "@/components/writer/writer-form-field";
import { WriterPrimaryButton } from "@/components/writer/writer-primary-button";
import { downloadTextFile } from "@/lib/download-text-file";
import type { FigmaGuidelineGeneratedFile, FigmaGuidelineGenerationResponse } from "@writer/contracts";

import { DaemonClientError } from "../daemon-client";
import {
  guidelineGenerationAlertKind,
  guidelineGenerationUiState
} from "../figma-guideline-generation-diagnostics";
import { WorkflowBackLink, WorkflowGlassPanel, WorkflowPageIntro, WorkflowScreenShell } from "../layout/workflow-screen-shell";
import { useWorkspace } from "../workspace-context";

export function FigmaGuidelineGeneratorScreen() {
  const { daemonClient, daemonConnected, workspaceReady, workspaceProjectId } = useWorkspace();
  const [figmaUrl, setFigmaUrl] = useState("");
  const [featureName, setFeatureName] = useState("");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FigmaGuidelineGenerationResponse | null>(null);

  const uiState = guidelineGenerationUiState(result, generating);
  const canSubmit =
    daemonConnected &&
    workspaceReady &&
    Boolean(workspaceProjectId) &&
    figmaUrl.trim().length > 0 &&
    featureName.trim().length > 0 &&
    description.trim().length > 0 &&
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
        featureName: featureName.trim(),
        description: description.trim()
      });
      const generation = await daemonClient.generateFigmaGuideline({ sessionId: session.id });
      setResult(generation);
    } catch (err) {
      const message =
        err instanceof DaemonClientError
          ? err.message
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
    <WorkflowScreenShell className="px-6 pt-6">
      <WorkflowBackLink />
      <WorkflowPageIntro
        title="Generate writing guidelines"
        description="Turn Figma UI copy into a downloadable starter pack: background, glossary, writing guide, and generation summary."
      />

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
        <InlineAlert kind="info" title="Generating starter pack" subtitle="Extracting Figma copy and running analysis…" />
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
          <WriterFormField label="Feature name" htmlFor="guide-feature-name">
            <WriterFormInput
              id="guide-feature-name"
              value={featureName}
              onChange={(event) => setFeatureName(event.target.value)}
              placeholder="Checkout redesign"
              disabled={generating}
            />
          </WriterFormField>
          <WriterFormField label="Description" htmlFor="guide-description">
            <WriterFormTextarea
              id="guide-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What should this writing guide cover?"
              disabled={generating}
              rows={3}
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
  );
}
