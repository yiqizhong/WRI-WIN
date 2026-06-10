import { describe, expect, it } from "vitest";
import { IncomingMessage, ServerResponse } from "node:http";

import { parseDaemonHealth } from "@writer/contracts";

import { handleHealthRequest } from "./health";

function createMockResponse() {
  const state = { statusCode: 0, body: "" };

  const response = {
    writeHead(code: number) {
      state.statusCode = code;
    },
    end(chunk: string) {
      state.body = chunk;
    }
  } as unknown as ServerResponse;

  return { response, state };
}

describe("health route", () => {
  it("returns daemon health payload", () => {
    const request = { method: "GET", url: "/health" } as IncomingMessage;
    const { response, state } = createMockResponse();

    const handled = handleHealthRequest(request, response, {
      config: {
        host: "127.0.0.1",
        port: 47631,
        token: "test-token",
        logDir: "/tmp",
        logLevel: "info",
        version: "0.1.0",
        apiRevision: "4",
        packaged: false
      },
      getCapabilitySummary: () => [{ id: "desktop-shell", status: "enabled" }]
    });

    expect(handled).toBe(true);
    expect(state.statusCode).toBe(200);

    const health = parseDaemonHealth(JSON.parse(state.body));
    expect(health.status).toBe("running");
    expect(health.version).toBe("0.1.0");
    expect(health.apiRevision).toBe("4");
  });
});
