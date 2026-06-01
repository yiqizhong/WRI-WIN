import { describe, expect, it } from "vitest";

import { buildGuidelineProgressView } from "./guideline-generation-progress";

describe("guideline-generation-progress", () => {
  it("marks earlier steps done and highlights the active stage", () => {
    const view = buildGuidelineProgressView({
      inFlight: true,
      startedAt: new Date(Date.now() - 90_000).toISOString(),
      progressStage: "semantic_analysis",
      progressBatchIndex: 2,
      progressBatchTotal: 5
    });

    expect(view).not.toBeNull();
    expect(view?.steps.find((step) => step.stage === "extracting_figma")?.state).toBe("done");
    expect(view?.steps.find((step) => step.stage === "semantic_analysis")?.state).toBe("active");
    expect(view?.steps.find((step) => step.stage === "rendering_files")?.state).toBe("pending");
    expect(view?.detailMessage).toBe("Batch 2 of 5");
    expect(view?.elapsedLabel).toMatch(/elapsed/);
  });

  it("returns null when the run is not in flight", () => {
    expect(buildGuidelineProgressView({ ok: true, completedAt: "2026-06-01T12:00:00.000Z" })).toBeNull();
  });
});
