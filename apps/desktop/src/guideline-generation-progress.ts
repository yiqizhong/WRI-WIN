import type { ReviewSession } from "@writer/contracts";

import { readGuidelineGenerationScope, type GuidelineGenerationScopeRecord } from "./guideline-run-status";

export const GUIDELINE_PROGRESS_STEPS = [
  { stage: "extracting_figma", label: "Extract text from Figma" },
  { stage: "building_candidates", label: "Build copy candidates" },
  { stage: "semantic_analysis", label: "Semantic analysis (AI)" },
  { stage: "generating_files", label: "Draft starter pack" },
  { stage: "rendering_files", label: "Prepare downloads" }
] as const;

export type GuidelineProgressStage = (typeof GUIDELINE_PROGRESS_STEPS)[number]["stage"];

export type GuidelineProgressStepState = "done" | "active" | "pending";

export type GuidelineProgressStepView = {
  stage: GuidelineProgressStage;
  label: string;
  state: GuidelineProgressStepState;
};

export type GuidelineProgressView = {
  steps: GuidelineProgressStepView[];
  detailMessage: string | null;
  elapsedLabel: string | null;
};

function stepIndexForStage(stage: string | undefined): number {
  if (!stage) {
    return 0;
  }

  const index = GUIDELINE_PROGRESS_STEPS.findIndex((step) => step.stage === stage);
  return index >= 0 ? index : 0;
}

export function formatGuidelineElapsed(startedAt: string | undefined): string | null {
  if (!startedAt) {
    return null;
  }

  const startedMs = Date.parse(startedAt);
  if (Number.isNaN(startedMs)) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s elapsed`;
  }

  return `${minutes}m ${seconds}s elapsed`;
}

export function buildGuidelineProgressView(
  generation: GuidelineGenerationScopeRecord | undefined
): GuidelineProgressView | null {
  if (!generation?.inFlight) {
    return null;
  }

  const activeIndex = stepIndexForStage(generation.progressStage);
  const steps = GUIDELINE_PROGRESS_STEPS.map((step, index) => ({
    stage: step.stage,
    label: step.label,
    state: (index < activeIndex ? "done" : index === activeIndex ? "active" : "pending") as GuidelineProgressStepState
  }));

  let detailMessage = generation.progressMessage ?? null;
  if (
    generation.progressBatchIndex != null &&
    generation.progressBatchTotal != null &&
    generation.progressBatchTotal > 0
  ) {
    detailMessage = `Batch ${generation.progressBatchIndex} of ${generation.progressBatchTotal}`;
  }

  return {
    steps,
    detailMessage,
    elapsedLabel: formatGuidelineElapsed(generation.startedAt)
  };
}

export function readGuidelineProgressView(session: ReviewSession): GuidelineProgressView | null {
  return buildGuidelineProgressView(readGuidelineGenerationScope(session));
}
