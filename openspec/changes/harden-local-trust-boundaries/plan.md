# Harden Local Trust Boundaries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the local daemon from trusting its network — add a per-launch auth token plus Host/Origin enforcement (V1), then close the file/command/URL sinks that the missing trust boundary made remotely reachable (V2–V6).

**Architecture:** The daemon mints a random token at startup and writes it to `~/.writer/daemon-token` (0600). The Electron preload reads that file and exposes it to the renderer; the daemon client attaches it as `Authorization: Bearer <token>` (or `?token=` for `<img src>`/download URLs). `router.ts` rejects any non-`/health` request lacking a valid token, a disallowed `Host`, or a disallowed `Origin`. Reuse-of-an-existing-daemon keeps working because the token lives in a file both sides read, not an env var baked into one process.

**Tech Stack:** TypeScript (ESM), Node `http`, Electron 39 (`contextBridge`), Zod 4, Vitest. Tests live next to source as `*.test.ts`.

**Source:** verified audit `docs/code-quality-audit-2026-06-09.md`. Linear epic WRI-240 (children WRI-242…247).

**Mapping to Linear/tasks.md:** Task 1 = WRI-242 §1 (V1). Task 2 = WRI-243 §2 (V2). Task 3 = WRI-244 §3 (V3). Task 4 = WRI-245 §4 (V4). Task 5 = WRI-246 §5 (V5). Task 6 = WRI-247 §6 (V6).

---

## File Structure

**V1 (Task 1) — daemon auth + token plumbing:**
- Modify `apps/daemon/src/config.ts` — add `token` to `DaemonConfig` + `loadDaemonConfig`.
- Create `apps/daemon/src/auth.ts` — pure request-authorization helpers (token + Host + Origin).
- Modify `apps/daemon/src/index.ts` — write the token file at startup.
- Modify `apps/daemon/src/router.ts` — enforce auth before routing; exempt `/health`.
- Modify `apps/desktop/electron/preload.cjs` — read the token file, expose `daemonToken`.
- Modify `apps/desktop/src/writer-desktop.d.ts` — type `daemonToken`.
- Modify `apps/desktop/src/daemon-client.ts` — attach token (header + `?token=` for URL helpers).
- Modify `apps/desktop/src/workspace-context.tsx` — pass the token into `createDaemonClient`.

**V2–V6 (Tasks 2–6):** small, independent edits — see each task.

---

## Task 1: V1 — Daemon auth token + Host/Origin enforcement (WRI-242)

**Files:**
- Modify: `apps/daemon/src/config.ts`
- Create: `apps/daemon/src/auth.ts`
- Test: `apps/daemon/src/auth.test.ts`
- Modify: `apps/daemon/src/index.ts`
- Modify: `apps/daemon/src/router.ts`
- Test: `apps/daemon/src/router.auth.test.ts`
- Modify: `apps/desktop/electron/preload.cjs`, `apps/desktop/src/writer-desktop.d.ts`
- Modify: `apps/desktop/src/daemon-client.ts`, `apps/desktop/src/workspace-context.tsx`

- [ ] **Step 1: Write the failing test for the auth helper**

Create `apps/daemon/src/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isRequestAuthorized, isHostAllowed, isOriginAllowed } from "./auth";

const TOKEN = "tok-123";
const PORT = 47631;

describe("isHostAllowed", () => {
  it("accepts loopback host with the daemon port", () => {
    expect(isHostAllowed("127.0.0.1:47631", PORT)).toBe(true);
    expect(isHostAllowed("localhost:47631", PORT)).toBe(true);
  });
  it("rejects a rebinding host", () => {
    expect(isHostAllowed("attacker.com", PORT)).toBe(false);
    expect(isHostAllowed("127.0.0.1:80", PORT)).toBe(false);
    expect(isHostAllowed(undefined, PORT)).toBe(false);
  });
});

describe("isOriginAllowed", () => {
  it("accepts no Origin (non-browser caller) and loopback origins", () => {
    expect(isOriginAllowed(undefined, PORT)).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:5173", PORT)).toBe(true);
    expect(isOriginAllowed("http://localhost:47631", PORT)).toBe(true);
  });
  it("rejects a foreign Origin", () => {
    expect(isOriginAllowed("https://evil.example", PORT)).toBe(false);
  });
});

describe("isRequestAuthorized", () => {
  it("accepts a matching bearer token", () => {
    expect(isRequestAuthorized({ authorization: `Bearer ${TOKEN}` }, "/agents", TOKEN)).toBe(true);
  });
  it("accepts a matching ?token= query (for <img>/download URLs)", () => {
    expect(isRequestAuthorized({}, `/sessions/x/screenshots/y?token=${TOKEN}`, TOKEN)).toBe(true);
  });
  it("rejects a missing/wrong token", () => {
    expect(isRequestAuthorized({}, "/agents", TOKEN)).toBe(false);
    expect(isRequestAuthorized({ authorization: "Bearer nope" }, "/agents", TOKEN)).toBe(false);
  });
  it("always allows /health unauthenticated", () => {
    expect(isRequestAuthorized({}, "/health", TOKEN)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm run test --workspace @writer/daemon -- auth`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 3: Implement `auth.ts`**

Create `apps/daemon/src/auth.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function isHostAllowed(host: string | undefined, port: number): boolean {
  if (!host) return false;
  const [name, p] = host.split(":");
  return LOCAL_HOSTS.has(name ?? "") && p === String(port);
}

export function isOriginAllowed(origin: string | undefined, port: number): boolean {
  if (!origin) return true; // non-browser callers send no Origin
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname) && Boolean(url.port);
  } catch {
    return false;
  }
}

function tokenFromUrl(url: string): string | null {
  const q = url.indexOf("?");
  if (q === -1) return null;
  return new URLSearchParams(url.slice(q + 1)).get("token");
}

/** /health is always open (startup probe + daemon reuse). Everything else needs the token. */
export function isRequestAuthorized(
  headers: { authorization?: string | undefined },
  url: string,
  token: string
): boolean {
  const path = url.split("?")[0] ?? url;
  if (path === "/health") return true;
  const header = headers.authorization;
  if (header && header.startsWith("Bearer ") && safeEqual(header.slice(7), token)) return true;
  const q = tokenFromUrl(url);
  return q !== null && safeEqual(q, token);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm run test --workspace @writer/daemon -- auth`
Expected: PASS (all cases).

- [ ] **Step 5: Add `token` to config**

In `apps/daemon/src/config.ts`, add the field to `DaemonConfig`:

```ts
export type DaemonConfig = {
  host: string;
  port: number;
  token: string;
  logDir: string;
  logLevel: LogLevel;
  version: string;
  apiRevision: string;
  packaged: boolean;
};
```

Add the import at the top:

```ts
import { randomUUID } from "node:crypto";
```

And in `loadDaemonConfig`'s returned object (after `port`):

```ts
    token: env.WRITER_DAEMON_TOKEN ?? randomUUID(),
```

- [ ] **Step 6: Write the token file at daemon startup**

In `apps/daemon/src/index.ts`, add imports:

```ts
import { writeFileSync } from "node:fs";
```

In `startDaemon()`, immediately after `const config = loadDaemonConfig();` and before the server is created:

```ts
  // Share the auth token with the Electron app (and any reused daemon's clients)
  // via a 0600 file both sides can read. Web pages cannot read it, so the
  // DNS-rebinding / CSRF threat is blocked while daemon reuse still works.
  try {
    writeFileSync(join(homedir(), ".writer", "daemon-token"), config.token, { mode: 0o600 });
  } catch (error) {
    logger.warn("Could not write daemon token file", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
```

(`homedir` and `join` are already imported in `index.ts`.)

- [ ] **Step 7: Write the failing router auth test**

Create `apps/daemon/src/router.auth.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequestHandler } from "./router";
import type { DaemonConfig } from "./config";
import type { DaemonState } from "./state";

function makeConfig(): DaemonConfig {
  return {
    host: "127.0.0.1", port: 47631, token: "tok-123",
    logDir: "/tmp", logLevel: "info", version: "0.0.0", apiRevision: "x", packaged: false
  };
}

function makeReqRes(method: string, url: string, headers: Record<string, string>) {
  const req = { method, url, headers } as unknown as IncomingMessage;
  const res = {
    statusCode: 0, headers: {} as Record<string, string>, ended: false, body: "",
    setHeader(k: string, v: string) { this.headers[k] = v; },
    writeHead(code: number) { this.statusCode = code; return this; },
    end(b?: string) { this.ended = true; if (b) this.body = b; }
  };
  return { req, res: res as unknown as ServerResponse & typeof res };
}

describe("router auth", () => {
  const state = {} as DaemonState;

  it("401s a request with no token", () => {
    const { req, res } = makeReqRes("GET", "/agents", { host: "127.0.0.1:47631" });
    createRequestHandler(makeConfig(), state)(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("403s a request with a foreign Host (DNS rebinding)", () => {
    const { req, res } = makeReqRes("GET", "/agents", { host: "evil.com", authorization: "Bearer tok-123" });
    createRequestHandler(makeConfig(), state)(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("lets /health through with no token", () => {
    const { req, res } = makeReqRes("GET", "/health", { host: "127.0.0.1:47631" });
    createRequestHandler(makeConfig(), state)(req, res);
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).not.toBe(403);
  });
});
```

- [ ] **Step 8: Run it to confirm it fails**

Run: `npm run test --workspace @writer/daemon -- router.auth`
Expected: FAIL — requests currently route without 401/403.

- [ ] **Step 9: Enforce auth in the router**

In `apps/daemon/src/router.ts`, add the import:

```ts
import { isRequestAuthorized, isHostAllowed, isOriginAllowed } from "./auth";
```

In `createRequestHandler`, inside the returned handler, after `applyDevCors(request, response);` and the existing `OPTIONS` short-circuit, add:

```ts
    if (!isHostAllowed(request.headers.host, config.port) ||
        !isOriginAllowed(request.headers.origin, config.port)) {
      response.writeHead(403);
      response.end();
      return;
    }

    if (!isRequestAuthorized(request.headers, request.url ?? "", config.token)) {
      response.writeHead(401);
      response.end();
      return;
    }
```

(Keep the `OPTIONS` block before this so CORS preflight still returns 204.)

- [ ] **Step 10: Run both daemon test files**

Run: `npm run test --workspace @writer/daemon -- auth router.auth`
Expected: PASS.

- [ ] **Step 11: Expose the token to the renderer via preload**

In `apps/desktop/electron/preload.cjs`, near the top add:

```js
const os = require("node:os");
const fsp = require("node:fs");
const { join: joinPath } = require("node:path");

let daemonToken = "";
try {
  daemonToken = fsp.readFileSync(joinPath(os.homedir(), ".writer", "daemon-token"), "utf8").trim();
} catch (_) {
  // Daemon not started yet / unreadable — requests will 401, surfaced as a connection error.
}
```

Add `daemonToken` to the `writerDesktop` object exposed via `contextBridge.exposeInMainWorld`:

```js
  daemonToken,
```

In `apps/desktop/src/writer-desktop.d.ts`, add `daemonToken: string;` to the `writerDesktop` interface.

- [ ] **Step 12: Attach the token in the daemon client**

In `apps/desktop/src/daemon-client.ts`, change the factory signature:

```ts
export function createDaemonClient(baseUrl = DEFAULT_BASE_URL, token = "") {
```

Add a header helper near the top of the factory body and thread it through the central `request`, `deleteRequest`, and the raw `fetch` calls (`exportMarkdown`, `exportHtml`, `deleteGuideline`, `deleteGlossary`). The simplest correct approach: build a default headers object once and merge it into every `init`.

Replace the standalone `request`/`deleteRequest`/`fetchWithTimeout` usages so each request includes:

```ts
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
```

- In `request(...)`: `fetchWithTimeout(\`${baseUrl}${path}\`, { ...init, headers: { ...authHeaders, ...(init?.headers ?? {}) } }, timeoutMs)`.
- In `deleteRequest(...)` and the inline `fetchWithTimeout` deletes: add `headers: authHeaders`.
- In `exportMarkdown`/`exportHtml` raw `fetch`: add `{ headers: authHeaders }`.
- For URL-string helpers used by `<img src>`/downloads — `sessionScreenshotUrl` and the `*TemplateUrl` helpers — append the token as a query param:

```ts
    sessionScreenshotUrl: (sessionId: string, frameId: string) =>
      `${baseUrl}/sessions/${encodeURIComponent(sessionId)}/screenshots/${encodeURIComponent(frameId.replace(/:/g, "-"))}?token=${encodeURIComponent(token)}`,
```

(Apply the same `?token=` suffix to the template URL helpers.)

- [ ] **Step 13: Pass the token from the renderer**

In `apps/desktop/src/workspace-context.tsx:116`:

```ts
  const daemonClient = useMemo(
    () => createDaemonClient(undefined, window.writerDesktop?.daemonToken ?? ""),
    []
  );
```

- [ ] **Step 14: Typecheck + full test run**

Run: `npm run typecheck`
Run: `npm run test`
Expected: PASS, no type errors.

- [ ] **Step 15: Manual smoke (the two UX-risk spots)**

1. Launch dev app fresh → daemon connects, screens load.
2. Launch again while the first daemon is still running (reuse path) → app still connects (token file read, not env-baked).
3. Confirm a Figma session's screenshots still render (token rides the `?token=` query).
Expected: all three work; no blank app, no broken thumbnails.

- [ ] **Step 16: Validate + commit**

Run: `npx openspec validate harden-local-trust-boundaries --type change` (deltas added in a later step of this change).
```bash
git add apps/daemon/src/{config,auth,index,router}.ts apps/daemon/src/{auth,router.auth}.test.ts \
  apps/desktop/electron/preload.cjs apps/desktop/src/{writer-desktop.d.ts,daemon-client.ts,workspace-context.tsx}
git commit -m "feat(daemon): require auth token + Host/Origin allowlist (WRI-242, V1)"
```

---

## Task 2: V2 — Gate adapter run + escape echo cmd.exe args (WRI-243)

**Files:**
- Modify: `apps/daemon/src/agents.ts` (`resolveAdapterForRun`)
- Modify: `packages/agent-adapters/src/echo-adapter.ts` (`buildEchoSpawn`)
- Test: `apps/daemon/src/agents.run-gate.test.ts`, `packages/agent-adapters/src/echo-adapter.test.ts`

- [ ] **Step 1: Failing test — echo is not runnable from request input**

In `apps/daemon/src/agents.run-gate.test.ts`, assert that `startAgentRun` with `adapterId: "echo"` throws (not a known adapter). Use the existing daemon test harness/`createDaemonState` pattern from `apps/daemon/src/agents.test.ts`.

```ts
import { describe, it, expect } from "vitest";
import { startAgentRun } from "./agents";
import { createDaemonState } from "./state";

describe("resolveAdapterForRun gate", () => {
  it("refuses a non-known adapter id from the request", async () => {
    const state = await createDaemonState({ dataDir: undefined });
    await expect(
      startAgentRun(state, { sessionId: "missing", adapterId: "echo", prompt: "x" })
    ).rejects.toThrow(); // session-not-found or unknown-adapter, never reaches echo spawn
  });
});
```

- [ ] **Step 2: Run → fails** (echo currently resolves). `npm run test --workspace @writer/daemon -- run-gate`

- [ ] **Step 3: Implement the gate** in `apps/daemon/src/agents.ts`, in `resolveAdapterForRun`, right after computing `adapterId`:

```ts
  if (adapterId && !isKnownAdapterId(adapterId)) {
    throw new Error(`Adapter not selectable: ${adapterId}`);
  }
```

(`isKnownAdapterId` is already imported in this file.)

- [ ] **Step 4: Run → passes.**

- [ ] **Step 5: Failing test — echo escapes cmd.exe metacharacters** in `packages/agent-adapters/src/echo-adapter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildEchoSpawn } from "./echo-adapter";

it("does not let cmd.exe metacharacters break out (Windows)", () => {
  const { args } = buildEchoSpawn('" & calc & "');
  // The injected prompt must be a single escaped argument, never bare ` & `.
  expect(args.join(" ")).not.toMatch(/\s&\scalc\s&/);
});
```

(Export `buildEchoSpawn` from `echo-adapter.ts` if not already.)

- [ ] **Step 6: Run → fails.**

- [ ] **Step 7: Implement escaping** — in `echo-adapter.ts`, on the Windows branch of `buildEchoSpawn`, route the prompt through `cli-runner`'s `escapeCmdMetacharacters` (export it from `cli-runner.ts` if needed), or switch to emitting the echo from Node without `cmd /c`. Minimal version reusing the existing escaper:

```ts
import { escapeCmdMetacharacters } from "./cli-runner";
// ...
  return isWindows
    ? { command: ECHO_PATH, args: ["/c", "echo", escapeCmdMetacharacters(prompt)] }
    : { command: ECHO_PATH, args: [prompt] };
```

- [ ] **Step 8: Run tests → pass. Typecheck. Commit** `feat(adapters): gate adapter runs + escape echo cmd args (WRI-243, V2)`.

---

## Task 3: V3 — Confine paste-text filePath (WRI-244)

**Files:** Modify `apps/daemon/src/paste-text.ts`; export/reuse `assertInsideDir` (currently private in `apps/daemon/src/guidelines/writer.ts` — promote to a shared `apps/daemon/src/fs-safety.ts` and import in both). Test: `apps/daemon/src/paste-text.confine.test.ts`.

- [ ] **Step 1:** Promote `assertInsideDir(targetPath, rootDir)` into `apps/daemon/src/fs-safety.ts` and re-export from `guidelines/writer.ts` (no behavior change there).
- [ ] **Step 2: Failing test** — `attachPasteTextFile` with `filePath: "/etc/passwd"` (or `"..\\..\\secret.txt"`) rejects; a path inside the allowed attachments root succeeds. Allowed root = the picked-file directory the renderer is permitted to read; if no such root is defined, accept only paths under the user's home documents or require an opaque id — confirm the intended root with the daemon's existing attachment handling before locking the test.
- [ ] **Step 3:** In `attachPasteTextFile`, before `readFile`/`parseSpreadsheetFile`, `const resolved = resolve(parsed.filePath); if (isAbsoluteOutsideRoot(resolved) || !assertInsideDir(resolved, ALLOWED_ROOT)) throw new Error("filePath outside allowed root");`. Apply to both the spreadsheet and text branches.
- [ ] **Step 4:** Run → pass. Typecheck. Commit `fix(daemon): confine paste-text filePath (WRI-244, V3)`.

---

## Task 4: V4 — Validate sessionId + assertInsideDir for screenshots (WRI-245)

**Files:** Modify `apps/daemon/src/figma-screenshots.ts` (`resolveScreenshotPath`) and `apps/daemon/src/routes/review.ts:485`. Test: `apps/daemon/src/figma-screenshots.test.ts`.

- [ ] **Step 1: Failing test** — `resolveScreenshotPath(state, "..%2f..%2fetc", "f")` (post-decode `../../etc`) must not resolve outside `<dataDir>/sessions`; a real UUID session resolves inside.
- [ ] **Step 2:** In the route handler, after decoding `sessionId`, verify it matches a known session (`state.store.getSession`/list) or a strict `^[A-Za-z0-9_-]+$` pattern; reject otherwise (404).
- [ ] **Step 3:** In `resolveScreenshotPath`, `assertInsideDir(resolved, join(dataDir, "sessions"))` before returning; throw/return null on failure so the route 404s.
- [ ] **Step 4:** Run → pass. Typecheck. Commit `fix(daemon): validate screenshot sessionId + confine path (WRI-245, V4)`.

---

## Task 5: V5 — Allowlist URL schemes in openExternal (WRI-246)

**Files:** Modify `apps/desktop/electron/main.cjs` (`writer:open-external` + `setWindowOpenHandler`). Test: `apps/desktop/electron/open-external.guard.test.ts`.

- [ ] **Step 1: Failing test** for a pure `isSafeExternalUrl` helper extracted into `main.cjs` (or a small `electron/url-guard.cjs`):

```js
const { isSafeExternalUrl } = require("./url-guard.cjs");
test("rejects file/UNC/custom, allows https", () => {
  expect(isSafeExternalUrl("https://figma.com/oauth")).toBe(true);
  expect(isSafeExternalUrl("file:///C:/evil.exe")).toBe(false);
  expect(isSafeExternalUrl("file://attacker/share/x")).toBe(false);
  expect(isSafeExternalUrl("evilscheme://run")).toBe(false);
});
```

- [ ] **Step 2:** Implement `isSafeExternalUrl(u)` → `try { return ["https:","http:","mailto:"].includes(new URL(u).protocol); } catch { return false; }`.
- [ ] **Step 3:** Guard both sinks: `if (isSafeExternalUrl(url)) await shell.openExternal(url);` else log+ignore; same inside `setWindowOpenHandler`.
- [ ] **Step 4:** Run → pass. Typecheck. Commit `fix(desktop): allowlist openExternal URL schemes (WRI-246, V5)`.

---

## Task 6: V6 — Confine renderer-supplied write paths (WRI-247, backlog)

**Files:** Modify `apps/desktop/electron/main.cjs` (`writer:save-text-file`, `writer:export-pdf-from-html`).

- [ ] **Step 1: Failing test** — a main-process set of dialog-approved paths rejects a write to an un-approved absolute path.
- [ ] **Step 2:** Track paths returned by `pickSaveFile`/`pickSaveFile`-style dialogs in a main-process `Set`; in the write/export handlers, reject any `filePath` not in that set. (Alternative: merge pick+write into one handler so the path never round-trips through the renderer.)
- [ ] **Step 3:** Run → pass. Typecheck. Commit `fix(desktop): confine renderer-supplied write paths (WRI-247, V6)`.

---

## Spec deltas

After the code tasks land, author the spec deltas per finding under
`openspec/changes/harden-local-trust-boundaries/specs/<capability>/spec.md`
(`local-daemon` for V1/V3/V4, `agent-adapter-runtime` for V2, `desktop-shell` for V5/V6) using
`## ADDED/MODIFIED Requirements` headers with at least one `#### Scenario:` each, then run
`npx openspec validate harden-local-trust-boundaries --type change --strict`.

## Self-review notes

- **Spec coverage:** Tasks 1–6 cover V1–V6 from `tasks.md`/audit. ✓
- **Token reuse:** token-file (not env) is what keeps daemon-reuse working — called out in Task 1 Step 6 + Step 15 smoke. ✓
- **`<img src>` screenshots:** handled by the `?token=` query in Task 1 Step 12 + verified in Step 15. ✓
- **Open confirmation:** Task 3's `ALLOWED_ROOT` for paste-text attachments must be confirmed against how the renderer supplies picked-file paths before the test is locked — flagged inline, not left as a silent placeholder.
