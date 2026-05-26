import { describe, expect, it } from "vitest";

import { createOptimisticTurn, mergeDisplayMessages } from "./optimistic-turn";

describe("mergeDisplayMessages", () => {
  it("shows optimistic pair when server is empty", () => {
    const optimistic = createOptimisticTurn("Paste this");
    const merged = mergeDisplayMessages(null, optimistic);

    expect(merged).toHaveLength(2);
    expect(merged[0]?.role).toBe("user");
    expect(merged[0]?.text).toBe("Paste this");
    expect(merged[1]?.status).toBe("pending");
  });

  it("replaces optimistic rows after server reconcile", () => {
    const optimistic = createOptimisticTurn("Paste this");
    const merged = mergeDisplayMessages(
      {
        id: "c1",
        projectId: "p1",
        inputMode: "plain_text",
        messages: [
          {
            id: "u-server",
            role: "user",
            text: "Paste this",
            createdAt: "2026-05-25T00:00:00.000Z"
          },
          {
            id: "a-server",
            role: "assistant",
            text: "",
            status: "pending",
            createdAt: "2026-05-25T00:00:00.000Z"
          }
        ],
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z"
      },
      optimistic
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]?.id).toBe("u-server");
    expect(merged[1]?.id).toBe("a-server");
  });

  it("keeps the optimistic user message mounted while welcome send motion is active", () => {
    const optimistic = createOptimisticTurn("Paste this");
    const merged = mergeDisplayMessages(
      {
        id: "c1",
        projectId: "p1",
        inputMode: "plain_text",
        messages: [
          {
            id: "u-server",
            role: "user",
            text: "Paste this",
            createdAt: "2026-05-25T00:00:00.000Z"
          },
          {
            id: "a-server",
            role: "assistant",
            text: "",
            status: "pending",
            createdAt: "2026-05-25T00:00:00.000Z"
          }
        ],
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z"
      },
      optimistic,
      { preserveOptimisticUser: true }
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]?.id).toBe(optimistic.userMessage.id);
    expect(merged[1]?.id).toBe("a-server");
  });
});
