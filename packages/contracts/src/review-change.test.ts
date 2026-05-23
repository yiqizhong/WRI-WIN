import { describe, expect, it } from "vitest";

import { parseChangeTransitionInput, parseReviewChange } from "./review-change";

describe("review change contract", () => {
  it("accepts lifecycle metadata", () => {
    const change = parseReviewChange({
      id: "chg-1",
      sessionId: "sess-1",
      sourceId: "node-1",
      status: "proposed",
      before: "Save",
      after: "Save changes",
      updatedAt: "2026-05-22T12:00:00.000Z",
      updatedBy: "agent"
    });

    expect(change.status).toBe("proposed");
  });

  it("accepts transition input", () => {
    const input = parseChangeTransitionInput({
      changeId: "chg-1",
      nextStatus: "approved",
      actor: "user"
    });

    expect(input.nextStatus).toBe("approved");
  });
});
