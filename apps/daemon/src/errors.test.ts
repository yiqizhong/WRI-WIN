import { describe, expect, it } from "vitest";

import { isApiError, parseApiError } from "@writer/contracts";

import { sendApiError, toApiError } from "./errors";

describe("daemon errors", () => {
  it("builds structured api errors", () => {
    const error = toApiError({
      code: "agent_unavailable",
      message: "Codex CLI was not found.",
      guidance: "Install Codex or pick another agent."
    });

    expect(error.code).toBe("agent_unavailable");
  });

  it("writes json error responses", () => {
    const state = { statusCode: 0, body: "" };
    const response = {
      writeHead(code: number) {
        state.statusCode = code;
      },
      end(chunk: string) {
        state.body = chunk;
      }
    } as import("node:http").ServerResponse;

    sendApiError(response, {
      code: "permission_denied",
      message: "Write tool blocked until approval.",
      guidance: "Approve the request in the review queue."
    });

    expect(state.statusCode).toBe(403);
    expect(isApiError(JSON.parse(state.body))).toBe(true);
    expect(parseApiError(JSON.parse(state.body)).code).toBe("permission_denied");
  });
});
