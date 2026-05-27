import { describe, expect, it } from "vitest";

import {
  deriveThinkingRibbonPhase,
  pickThinkingRibbonStatusMessage,
  THINKING_RIBBON_ROTATE_MS,
  THINKING_RIBBON_STATUS_MESSAGES
} from "./text-copy-thinking-ribbon";

describe("deriveThinkingRibbonPhase", () => {
  it("shows thinking with no events", () => {
    expect(deriveThinkingRibbonPhase({ events: [] })).toBe("thinking");
  });

  it("shows thinking while tools run", () => {
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
    ).toBe("thinking");
  });

  it("shows thinking on stream delta", () => {
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

  it("shows thinking after stream final", () => {
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
    ).toBe("thinking");
  });

  it("surfaces failed state", () => {
    expect(deriveThinkingRibbonPhase({ events: [], runStatus: "failed" })).toBe("failed");
  });
});

describe("thinking ribbon status copy", () => {
  it("rotates every 3 seconds", () => {
    expect(THINKING_RIBBON_ROTATE_MS).toBe(3000);
  });

  it("picks at random from the status message pool", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(THINKING_RIBBON_STATUS_MESSAGES).toContain(pickThinkingRibbonStatusMessage());
    }
  });

  it("never repeats the current message on the next pick", () => {
    const current = THINKING_RIBBON_STATUS_MESSAGES[0];
    for (let i = 0; i < 20; i += 1) {
      expect(pickThinkingRibbonStatusMessage(current)).not.toBe(current);
    }
  });
});
