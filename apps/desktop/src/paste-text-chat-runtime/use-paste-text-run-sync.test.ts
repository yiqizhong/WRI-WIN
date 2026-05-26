import { describe, expect, it } from "vitest";

import { createOptimisticTurn } from "./optimistic-turn";
import { shouldPollPendingAssistant } from "./use-paste-text-run-sync";

describe("shouldPollPendingAssistant", () => {
  it("does not poll optimistic assistant messages before server reconciliation", () => {
    const optimistic = createOptimisticTurn("Paste this");

    expect(shouldPollPendingAssistant(optimistic.assistantMessage)).toBe(false);
  });
});
