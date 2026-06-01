import type { FigmaGuidelineGenerationResponse } from "@writer/contracts";

import { formatConnectionDiagnostic } from "./connection-diagnostics";

export type GuidelineGenerationUiState =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "failed"; title: string; subtitle: string }
  | { kind: "degraded"; title: string; subtitle: string }
  | { kind: "success"; title: string; subtitle?: string };

export function guidelineGenerationUiState(
  result: FigmaGuidelineGenerationResponse | null,
  generating: boolean
): GuidelineGenerationUiState {
  if (generating) {
    return { kind: "generating" };
  }
  if (!result) {
    return { kind: "idle" };
  }
  if (!result.ok) {
    return {
      kind: "failed",
      title: "Guideline generation failed",
      subtitle:
        formatConnectionDiagnostic(result.diagnostic) ??
        result.diagnostics.join(" ") ??
        "Generation could not complete."
    };
  }

  const degraded =
    result.semanticAnalysis?.status === "fallback" ||
    result.diagnostics.some((item) => item.toLowerCase().includes("fallback")) ||
    result.diagnostics.some((item) => item.toLowerCase().includes("deterministic"));

  if (degraded) {
    return {
      kind: "degraded",
      title: "Starter pack ready with fallback analysis",
      subtitle: result.diagnostics.join(" ")
    };
  }

  return {
    kind: "success",
    title: "Starter pack ready",
    subtitle: `${result.files?.length ?? 0} files available to download.`
  };
}

export function guidelineGenerationAlertKind(
  state: GuidelineGenerationUiState
): "error" | "success" | "warning" | "info" {
  switch (state.kind) {
    case "failed":
      return "error";
    case "degraded":
      return "warning";
    case "success":
      return "success";
    case "generating":
      return "info";
    default:
      return "info";
  }
}
