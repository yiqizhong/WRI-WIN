import { describe, expect, it } from "vitest";

import { deriveThinkingRibbonPhase } from "./text-copy-thinking-ribbon";

describe("deriveThinkingRibbonPhase", () => {
  it("starts at connecting with no events", () => {
    expect(deriveThinkingRibbonPhase({ events: [] })).toBe("connecting");
  });

  it("moves to loading-guidelines on first non-text event", () => {
    expect(
      deriveThinkingRibbonPhase({
        events: [
          {
            id: "1",
            runId: "r1",
            type: "tool_request",
            payload: {},
            timestamp: "2026-05-25T00:00:00.000Z"
          }
        ]
      })
    ).toBe("loading-guidelines");
  });

  it("moves to thinking on stream delta", () => {
    expect(
      deriveThinkingRibbonPhase({
        events: [
          {
            id: "1",
            runId: "r1",
            type: "text",
            payload: { streamDelta: true, text: "Save" },
            timestamp: "2026-05-25T00:00:00.000Z"
          }
        ]
      })
    ).toBe("thinking");
  });

  it("moves to integrating on stream final", () => {
    expect(
      deriveThinkingRibbonPhase({
        events: [
          {
            id: "1",
            runId: "r1",
            type: "text",
            payload: { streamFinal: true, text: "Save changes" },
            timestamp: "2026-05-25T00:00:00.000Z"
          }
        ],
        runStatus: "completed"
      })
    ).toBe("integrating");
  });

  it("surfaces failed state", () => {
    expect(deriveThinkingRibbonPhase({ events: [], runStatus: "failed" })).toBe("failed");
  });
});
