import { describe, expect, it } from "vitest";

import { isApiError, parseApiError } from "./api-error";

describe("api error contract", () => {
  it("accepts a structured error payload", () => {
    const error = parseApiError({
      code: "agent_unavailable",
      message: "Codex CLI was not found on PATH.",
      guidance: "Install Codex or choose another agent in Settings."
    });

    expect(error.code).toBe("agent_unavailable");
    expect(error.guidance).toContain("Settings");
  });

  it("rejects malformed error payloads", () => {
    expect(() =>
      parseApiError({
        code: "unknown_code",
        message: "Broken"
      })
    ).toThrow();
  });

  it("detects api errors with isApiError", () => {
    expect(
      isApiError({
        code: "permission_denied",
        message: "Write tool blocked."
      })
    ).toBe(true);
    expect(isApiError({ error: "nope" })).toBe(false);
  });
});
