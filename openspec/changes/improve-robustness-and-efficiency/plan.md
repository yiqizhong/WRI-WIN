# Improve Robustness & Efficiency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three user-felt quality issues — interrupted model downloads restarting from scratch (R1), the app slowing as the store grows (E1), and battery/CPU drain from a 100ms run poll (E3) — then the four LOW backlog items.

**Architecture:** Each fix extracts a small **pure, testable unit** from code that is otherwise hard to test (real `fetch`/`fs`/timers): a resume-decision helper for downloads, a coalescing/compact save for the store, and a reusable in-flight-guarded poller the two chat call sites share.

**Tech Stack:** TypeScript (ESM), Node `fs`/`stream`, React 19, Vitest (with `vi.useFakeTimers`). Tests live next to source as `*.test.ts`.

**Source:** verified audit `docs/code-quality-audit-2026-06-09.md` (cross-check downgraded E1 framing, E2, R2). Linear epic WRI-241 (children WRI-248…254).

**Mapping:** Task 1 = WRI-248 §1 (R1). Task 2 = WRI-249 §2 (E1). Task 3 = WRI-250 §3 (E3). Task 4 = WRI-251 §4 (E2). Task 5 = WRI-252 §5 (E4). Task 6 = WRI-253 §6 (R2). Task 7 = WRI-254 §7 (R3).

---

## File Structure

- Create `apps/daemon/src/download-resume.ts` + test — pure resume-decision helpers (R1).
- Modify `apps/daemon/src/local-models.ts` — use the helpers + `stat(tmp)` (R1); later `pipeline()` (E4).
- Modify `packages/storage/src/store.ts` + test — compact JSON + coalesced save (E1); surface save error (R2).
- Create `apps/desktop/src/lib/create-run-poller.ts` + test — interval + in-flight guard (E3).
- Modify `apps/desktop/src/paste-text-chat-panel.tsx` and `.../use-paste-text-run-sync.ts` — use the shared poller (E3).
- Modify `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` — cache device probe (E2); evict-on-reset (R3).

---

## Task 1: R1 — Download resume integrity (WRI-248)

**Files:**
- Create: `apps/daemon/src/download-resume.ts`
- Test: `apps/daemon/src/download-resume.test.ts`
- Modify: `apps/daemon/src/local-models.ts` (`runDownload`)

- [ ] **Step 1: Write the failing test**

Create `apps/daemon/src/download-resume.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { planResume, classifyResumeResponse } from "./download-resume";

describe("planResume", () => {
  it("derives the offset from the actual tmp size, not a stored guess", () => {
    expect(planResume(0)).toEqual({ resumeFrom: 0, rangeHeader: null });
    expect(planResume(1_234)).toEqual({ resumeFrom: 1_234, rangeHeader: "bytes=1234-" });
  });
});

describe("classifyResumeResponse", () => {
  it("appends only when a resume got a 206", () => {
    expect(classifyResumeResponse(206, 1000)).toBe("append");
  });
  it("restarts when a resume got a 200 (Range ignored)", () => {
    expect(classifyResumeResponse(200, 1000)).toBe("restart");
  });
  it("writes fresh on a first-time 200", () => {
    expect(classifyResumeResponse(200, 0)).toBe("write");
  });
  it("errors on any other status", () => {
    expect(classifyResumeResponse(403, 0)).toBe("error");
    expect(classifyResumeResponse(500, 1000)).toBe("error");
  });
});
```

- [ ] **Step 2: Run → fails** — `npm run test --workspace @writer/daemon -- download-resume` → `Cannot find module './download-resume'`.

- [ ] **Step 3: Implement the helpers** — create `apps/daemon/src/download-resume.ts`:

```ts
export function planResume(tmpSizeOnDisk: number): { resumeFrom: number; rangeHeader: string | null } {
  if (tmpSizeOnDisk > 0) return { resumeFrom: tmpSizeOnDisk, rangeHeader: `bytes=${tmpSizeOnDisk}-` };
  return { resumeFrom: 0, rangeHeader: null };
}

export type ResumeAction = "append" | "restart" | "write" | "error";

export function classifyResumeResponse(status: number, resumeFrom: number): ResumeAction {
  if (status !== 200 && status !== 206) return "error";
  if (resumeFrom > 0) return status === 206 ? "append" : "restart"; // 200 = server ignored Range
  return "write";
}
```

- [ ] **Step 4: Run → passes.**

- [ ] **Step 5: Wire into `runDownload`** (`apps/daemon/src/local-models.ts`). Replace the `resumeFrom`/headers/`createWriteStream` logic so the offset comes from `stat(tmpPath)` and the response is classified:

```ts
  // Derive the resume offset from the ACTUAL partial on disk, not the store's
  // periodically-saved byte count (which under-counts after a crash).
  let tmpSize = 0;
  try { tmpSize = (await stat(tempPath)).size; } catch { tmpSize = 0; }
  const { resumeFrom, rangeHeader } = planResume(tmpSize);

  const headers: Record<string, string> = {};
  if (rangeHeader) headers["Range"] = rangeHeader;
  const hfToken = process.env["WRITER_HF_TOKEN"];
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

  const response = await fetch(manifest.downloadUrl, { headers, signal, redirect: "follow" });

  const action = classifyResumeResponse(response.status, resumeFrom);
  if (action === "error") throw new Error(`Download failed: HTTP ${response.status}`);

  // 200 on a resume means Range was ignored → truncate and start over.
  const append = action === "append";
  const startBytes = append ? resumeFrom : 0;
  const fileStream = createWriteStream(tempPath, { flags: append ? "a" : "w" });
  let downloadedBytes = startBytes;
```

Update the imports at the top of `local-models.ts` to add `planResume, classifyResumeResponse` from `./download-resume` (`stat` is already imported from `node:fs/promises`).

- [ ] **Step 6: Add an integration-ish test** in `local-models.test.ts` (the suite already exists): simulate a partial `.tmp` then a resume that returns 200 → assert the final file is SHA-valid (no duplicated bytes) by checking the written size equals the manifest size. Follow the existing mocking pattern in that file.

- [ ] **Step 7: Typecheck + test. Commit** `fix(daemon): resume downloads from real tmp size, require 206 to append (WRI-248, R1)`.

---

## Task 2: E1 — Bounded store writes (WRI-249)

**Files:**
- Modify: `packages/storage/src/store.ts` (`writeSnapshotToDisk`, `save`)
- Test: `packages/storage/src/store.save.test.ts`

- [ ] **Step 1: Failing test — compact JSON + coalesced writes** — create `packages/storage/src/store.save.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlatformStore } from "./store";

describe("store save", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("writes compact JSON (no pretty-print indentation)", async () => {
    const store = new PlatformStore({ dataDir: undefined });
    const spy = vi.spyOn(store as any, "writeFileImpl").mockResolvedValue(undefined);
    await (store as any).writeSnapshotToDisk();
    const payload = spy.mock.calls[0][1] as string;
    expect(payload).not.toMatch(/\n {2}"version"/); // no 2-space indented keys
  });

  it("coalesces a synchronous burst of save() into a single write", async () => {
    const store = new PlatformStore({ dataDir: undefined });
    const spy = vi.spyOn(store as any, "writeFileImpl").mockResolvedValue(undefined);
    void store.save(); void store.save(); void store.save();
    await vi.runAllTimersAsync();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Make the write injectable + compact, and coalesce `save()`** in `store.ts`. Extract the raw write so it can be spied, drop `null, 2`, and replace `save()`/`saveChain` with a dirty-flag coalescer:

```ts
  private pending: Promise<void> | null = null;
  private dirty = false;
  private lastSaveError: Error | null = null;

  /** Public save: marks dirty and coalesces concurrent/bursty calls into minimal writes. */
  async save(): Promise<void> {
    this.dirty = true;
    if (!this.pending) {
      this.pending = (async () => {
        await Promise.resolve(); // collapse a synchronous burst into one write
        while (this.dirty) {
          this.dirty = false;
          await this.writeSnapshotToDisk();
        }
        this.pending = null;
      })();
    }
    return this.pending;
  }

  private async writeSnapshotToDisk(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const payload = JSON.stringify(this.snapshot); // compact: machine-read file
    const tempPath = `${this.filePath}.tmp`;
    await this.writeFileImpl(tempPath, payload);
    await rename(tempPath, this.filePath);
  }

  /** Seam for tests; real impl writes utf8. */
  private async writeFileImpl(path: string, data: string): Promise<void> {
    await writeFile(path, data, "utf8");
  }
```

- [ ] **Step 4: Run → passes.** Then run the existing storage suite to confirm round-trip on reload is unchanged (compact JSON parses identically): `npm run test --workspace @writer/storage`.

- [ ] **Step 5: Typecheck + full test. Commit** `perf(storage): compact + coalesced store writes (WRI-249, E1)`.

> Note: the coalescer uses a microtask (`await Promise.resolve()`), not a wall-clock delay, so awaited saves stay prompt — it only collapses writes issued within the same tick. The optional append-only-log split (tasks.md §2.3) is deferred as a stretch and not in this plan.

---

## Task 3: E3 — Run-status polling (WRI-250)

**Files:**
- Create: `apps/desktop/src/lib/create-run-poller.ts`
- Test: `apps/desktop/src/lib/create-run-poller.test.ts`
- Modify: `apps/desktop/src/paste-text-chat-panel.tsx`, `apps/desktop/src/paste-text-chat-runtime/use-paste-text-run-sync.ts`

- [ ] **Step 1: Failing test** — create `apps/desktop/src/lib/create-run-poller.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRunPoller } from "./create-run-poller";

describe("createRunPoller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("never overlaps: skips a tick while a poll is in-flight", async () => {
    let inFlight = 0, maxConcurrent = 0;
    const poll = vi.fn(async () => {
      inFlight++; maxConcurrent = Math.max(maxConcurrent, inFlight);
      await new Promise((r) => setTimeout(r, 1500)); // slower than the interval
      inFlight--;
    });
    const stop = createRunPoller(poll, 500);
    await vi.advanceTimersByTimeAsync(2000);
    expect(maxConcurrent).toBe(1);
    stop();
  });
});
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement** `apps/desktop/src/lib/create-run-poller.ts`:

```ts
/** Polls `fn` every `intervalMs`, skipping ticks while a previous call is still in flight. */
export function createRunPoller(fn: () => Promise<void>, intervalMs: number): () => void {
  let busy = false;
  let stopped = false;
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try { await fn(); } finally { busy = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  return () => { stopped = true; clearInterval(timer); };
}
```

- [ ] **Step 4: Run → passes.**

- [ ] **Step 5: Use it in both call sites.** In `paste-text-chat-panel.tsx`, replace the `setInterval(() => void poll(), 100)` block (and its `void poll()` + `clearInterval`) with:

```ts
    const stop = createRunPoller(poll, RUN_POLL_INTERVAL_MS);
    return () => { cancelled = true; stop(); };
```

In `use-paste-text-run-sync.ts`, replace its `setInterval(() => void poll(), RUN_POLL_INTERVAL_MS)` block the same way. Import `createRunPoller` and the shared `RUN_POLL_INTERVAL_MS` (already exported from `paste-text-chat-runtime/message-display.ts`, value 500) in both files; delete the panel's hard-coded `100`.

- [ ] **Step 6: Typecheck + full test. Commit** `perf(desktop): shared in-flight-guarded run poller at 500ms (WRI-250, E3)`.

---

## Task 4: E2 — Cache GPU device detection (WRI-251, backlog)

**Files:** Modify `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`; Test: extend `local-gemma-adapter.test.ts`.

- [ ] **Step 1: Failing test** — two `detect()` calls (model installed, layers≠0) spawn `--list-devices` at most once. Spy on the `listGpuDevices` path or assert via an injected spawn count.
- [ ] **Step 2:** Introduce a module-level `cachedGpuDevices` (mirroring `cachedNvidiaVram` at `:188`); have `detect()` and `detectNvidiaVram()` share one cached probe. Add a reset for `--force` if detection needs invalidation.
- [ ] **Step 3:** Run → pass. Commit `perf(adapters): cache llama-cli device probe in detect() (WRI-251, E2)`.

---

## Task 5: E4 — Stream pipeline for download writes (WRI-252, backlog)

**Files:** Modify `apps/daemon/src/local-models.ts`.

- [ ] **Step 1:** Replace the per-chunk `for await … fileStream.write(value)` loop with `await pipeline(Readable.fromWeb(response.body), progressTransform, fileStream)`, where `progressTransform` is a small `Transform` that increments `downloadedBytes` and throttles the 2s store save. Import `pipeline` from `node:stream/promises`, `Readable` + `Transform` from `node:stream`.
- [ ] **Step 2:** Preserve abort (`signal`) and the SHA verify after rename. Test that a mocked stream still produces a SHA-valid file and reports progress. Commit `perf(daemon): stream download via pipeline() (WRI-252, E4)`.

---

## Task 6: R2 — Surface save errors (WRI-253, backlog)

**Files:** Modify `apps/daemon/src/review.ts:239`; `packages/storage/src/store.ts`.

- [ ] **Step 1:** Replace `void state.store.save()` at `review.ts:239` with `await state.store.save()` (or `.catch(logAndFlag)` if it must stay non-blocking).
- [ ] **Step 2:** In `store.ts`, record `this.lastSaveError` on a failed `writeSnapshotToDisk` and expose a `getLastSaveError()` the daemon can log/surface. Test that a mocked write failure sets it. Commit `fix(storage): surface save errors instead of dropping them (WRI-253, R2)`.

---

## Task 7: R3 — Evict resident runtime on model reset (WRI-254, backlog)

**Files:** Modify `apps/daemon/src/local-models.ts` (`resetModelDownload`); optionally `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`.

- [ ] **Step 1: Failing test** — after `resetModelDownload`, the next adapter run does not reuse the prior resident process (assert `shutdownLocalGemmaRuntime` was called, or that the runtime is re-created).
- [ ] **Step 2:** Call `shutdownLocalGemmaRuntime()` at the end of `resetModelDownload` (it's already imported in `local-models.ts`). Commit `fix(adapters): evict resident runtime on model reset (WRI-254, R3)`.

---

## Spec deltas

After the code lands, author per-finding deltas under
`openspec/changes/improve-robustness-and-efficiency/specs/<capability>/spec.md`
(`local-daemon` for R1/E4, `store-eviction`/`review-session-storage` for E1/R2,
`renderer-polling-stability` for E3, `agent-adapter-runtime` for E2/R3) with
`## ADDED/MODIFIED Requirements` + a `#### Scenario:` each, then
`npx openspec validate improve-robustness-and-efficiency --type change --strict`.

## Self-review notes

- **Spec coverage:** Tasks 1–7 cover R1, E1, E3, E2, E4, R2, R3. ✓
- **No added latency in E1:** coalescer uses a microtask, not a timer — called out in Task 2. ✓
- **E3 dedup:** both call sites use the one `createRunPoller`; panel's hard-coded `100` removed. ✓
- **Type consistency:** `planResume`/`classifyResumeResponse`, `createRunPoller`, `writeFileImpl` names are used identically across their tasks. ✓
- **Open confirmation:** Task 1 Step 6 and Task 5 follow the existing `local-models.test.ts` mocking pattern — verify that pattern before locking the integration assertions.
