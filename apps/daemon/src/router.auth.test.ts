import { describe, it, expect } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequestHandler } from "./router";
import type { DaemonConfig } from "./config";
import type { DaemonState } from "./state";

function makeConfig(): DaemonConfig {
  return { host: "127.0.0.1", port: 47631, token: "tok-123",
    logDir: "/tmp", logLevel: "info", version: "0.0.0", apiRevision: "x", packaged: false };
}
function makeReqRes(method: string, url: string, headers: Record<string, string>) {
  const req = { method, url, headers } as unknown as IncomingMessage;
  const res = { statusCode: 0, headers: {} as Record<string, string>, ended: false, body: "",
    setHeader(k: string, v: string) { this.headers[k] = v; },
    writeHead(code: number) { this.statusCode = code; return this; },
    end(b?: string) { this.ended = true; if (b) this.body = b; } };
  return { req, res: res as unknown as ServerResponse & typeof res };
}
describe("router auth", () => {
  const state = {} as DaemonState;
  it("401s a request with no token", () => {
    const { req, res } = makeReqRes("GET", "/agents", { host: "127.0.0.1:47631" });
    createRequestHandler(makeConfig(), state)(req, res);
    expect(res.statusCode).toBe(401);
  });
  it("403s a foreign Host", () => {
    const { req, res } = makeReqRes("GET", "/agents", { host: "evil.com", authorization: "Bearer tok-123" });
    createRequestHandler(makeConfig(), state)(req, res);
    expect(res.statusCode).toBe(403);
  });
  it("lets /health through with no token", () => {
    // /health is handled in a fire-and-forget async path that reads
    // state.mcp.figma; give it a minimal stub so the handler doesn't throw an
    // unhandled rejection. This test only asserts the auth gate, not the body.
    const healthState = { mcp: { figma: { enabled: false } } } as unknown as DaemonState;
    const { req, res } = makeReqRes("GET", "/health", { host: "127.0.0.1:47631" });
    createRequestHandler(makeConfig(), healthState)(req, res);
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).not.toBe(403);
  });
});
