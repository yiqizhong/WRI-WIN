import { describe, expect, it } from "vitest";

import { deriveChatPhase } from "./chat-phase";
import { createOptimisticTurn } from "./optimistic-turn";

describe("deriveChatPhase", () => {
  it("returns welcome with no user messages", () => {
    expect(
      deriveChatPhase({
        serverMessages: [],
        optimisticTurn: null
      })
    ).toBe("welcome");
  });

  it("returns active when optimistic turn exists", () => {
    expect(
      deriveChatPhase({
        serverMessages: [],
        optimisticTurn: createOptimisticTurn("Hello")
      })
    ).toBe("active");
  });

  it("returns active when server has a user message", () => {
    expect(
      deriveChatPhase({
        serverMessages: [
          {
            id: "u1",
            role: "user",
            text: "Hi",
            createdAt: "2026-05-25T00:00:00.000Z"
          }
        ],
        optimisticTurn: null
      })
    ).toBe("active");
  });

  it("returns welcome when forceWelcome is set", () => {
    expect(
      deriveChatPhase({
        serverMessages: [
          {
            id: "u1",
            role: "user",
            text: "Hi",
            createdAt: "2026-05-25T00:00:00.000Z"
          }
        ],
        optimisticTurn: null,
        forceWelcome: true
      })
    ).toBe("welcome");
  });
});
