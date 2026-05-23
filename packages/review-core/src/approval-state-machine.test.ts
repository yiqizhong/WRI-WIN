import { describe, expect, it } from "vitest";

import { assertChangeTransition, canTransitionChange, isWritebackEligible } from "./approval-state-machine";

describe("approval state machine", () => {
  it("allows proposed to approved", () => {
    expect(canTransitionChange("proposed", "approved")).toBe(true);
    expect(() => assertChangeTransition("proposed", "approved")).not.toThrow();
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionChange("detected", "applied")).toBe(false);
  });

  it("marks approved and edited as writeback eligible", () => {
    expect(isWritebackEligible("approved")).toBe(true);
    expect(isWritebackEligible("edited")).toBe(true);
    expect(isWritebackEligible("proposed")).toBe(false);
  });
});
