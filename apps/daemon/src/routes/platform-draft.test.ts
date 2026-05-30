import { describe, it, expect, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import { PlatformStore } from "@writer/storage";
import type { DaemonState } from "../state";
import { handlePlatformRequest } from "./platform";

function makeDaemonState(dataDir: string): DaemonState {
  const store = new PlatformStore({ dataDir });
  return {
    store,
    permissionRequests: [],
    activeRuns: new Map(),
    mcp: {} as DaemonState["mcp"]
  };
}

function makeRequest(method: string, url: string, body?: unknown): IncomingMessage {
  const bodyBuf =
    body !== undefined ? Buffer.from(JSON.stringify(body)) : null;

  const req = {
    method,
    url,
    [Symbol.asyncIterator]: async function* () {
      if (bodyBuf) yield bodyBuf;
    }
  } as unknown as IncomingMessage;

  return req;
}

function makeResponse() {
  let statusCode = 0;
  let body = "";

  const res = {
    writeHead(code: number) {
      statusCode = code;
    },
    end(chunk: string) {
      body = chunk;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    getBody() {
      return JSON.parse(body);
    }
  } as unknown as ServerResponse & { getBody(): unknown };

  return res as typeof res & { statusCode: number; body: string; getBody(): unknown };
}

describe("draft model routes", () => {
  let state: DaemonState;

  beforeEach(async () => {
    const dataDir = join(tmpdir(), `writer-routes-test-${randomUUID()}`);
    await mkdir(dataDir, { recursive: true });
    state = makeDaemonState(dataDir);
    await state.store.load();
  });

  describe("POST /local-model/draft/install", () => {
    it("returns installed:false when manifest has no draftModel", async () => {
      const req = makeRequest("POST", "/local-model/draft/install");
      const res = makeResponse();

      const handled = await handlePlatformRequest(req, res, state);

      expect(handled).toBe(true);
      expect(res.statusCode).toBe(200);
      const body = res.getBody() as { installed: boolean };
      expect(body.installed).toBe(false);
    });
  });

  describe("PUT /local-model/draft/enabled", () => {
    it("persists enabled=true", async () => {
      const req = makeRequest("PUT", "/local-model/draft/enabled", { enabled: true });
      const res = makeResponse();

      const handled = await handlePlatformRequest(req, res, state);

      expect(handled).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(state.store.getSpeculativeDecoding().enabled).toBe(true);
    });

    it("persists enabled=false", async () => {
      state.store.setSpeculativeDecoding({ enabled: true });
      await state.store.save();

      const req = makeRequest("PUT", "/local-model/draft/enabled", { enabled: false });
      const res = makeResponse();

      await handlePlatformRequest(req, res, state);
      expect(state.store.getSpeculativeDecoding().enabled).toBe(false);
    });

    it("returns 400 on invalid body", async () => {
      const req = makeRequest("PUT", "/local-model/draft/enabled", { enabled: "yes" });
      const res = makeResponse();

      await handlePlatformRequest(req, res, state);
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 on missing body", async () => {
      const req = makeRequest("PUT", "/local-model/draft/enabled");
      const res = makeResponse();

      await handlePlatformRequest(req, res, state);
      expect(res.statusCode).toBe(400);
    });
  });
});
