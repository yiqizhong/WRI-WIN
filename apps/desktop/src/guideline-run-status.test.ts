import { describe, expect, it } from "vitest";

import type { ReviewSession } from "@writer/contracts";

import {
  deriveGuidelineRunStatus,
  formatGuidelineProductName,
  isFigmaGuidelineSession
} from "./guideline-run-status";

function session(partial: Partial<ReviewSession> & Pick<ReviewSession, "id">): ReviewSession {
  return {
    projectId: "proj-1",
    sourceType: "figma",
    scope: {},
    status: "draft",
    agentRunIds: [],
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-01T12:00:00.000Z",
    ...partial
  };
}

describe("guideline-run-status", () => {
  it("detects guideline sessions by workflow or description", () => {
    expect(
      isFigmaGuidelineSession(
        session({
          id: "a",
          scope: { workflow: "figma_guideline_generation" }
        })
      )
    ).toBe(true);
    expect(
      isFigmaGuidelineSession(
        session({
          id: "b",
          description: "Writing guidelines for DDPM."
        })
      )
    ).toBe(true);
    expect(
      isFigmaGuidelineSession(
        session({
          id: "c",
          featureName: "Checkout",
          description: "Audit checkout flow."
        })
      )
    ).toBe(false);
  });

  it("derives status from persisted guideline generation", () => {
    expect(
      deriveGuidelineRunStatus(
        session({
          id: "done",
          scope: {
            guidelineGeneration: { ok: true, completedAt: "2026-06-01T12:00:00.000Z", fileNames: ["a.md"] }
          }
        })
      ).label
    ).toBe("Done");

    expect(
      deriveGuidelineRunStatus(
        session({
          id: "fail",
          scope: {
            guidelineGeneration: { ok: false, completedAt: "2026-06-01T12:00:00.000Z" }
          }
        })
      ).label
    ).toBe("Fail");

    expect(
      deriveGuidelineRunStatus(
        session({
          id: "running",
          status: "running",
          scope: {
            guidelineGeneration: { inFlight: true, startedAt: "2026-06-01T12:00:00.000Z" }
          }
        })
      ).label
    ).toBe("In Progress");

    expect(
      deriveGuidelineRunStatus(
        session({
          id: "orphan",
          status: "draft",
          scope: {}
        })
      )
    ).toEqual({ label: "Not started", variant: "pending" });
  });

  it("shows the generator product name in the log table", () => {
    expect(
      formatGuidelineProductName(
        session({
          id: "product",
          featureName: "DDPM"
        })
      )
    ).toBe("DDPM");

    expect(
      formatGuidelineProductName(
        session({
          id: "from-description",
          description: "Writing guidelines for DAMA."
        })
      )
    ).toBe("DAMA");
  });
});
