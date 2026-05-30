# Expand Local Context Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the Local Gemma usable context to 16K, keep the prompt within the window via token-aware history trimming, preserve ~50 tok/s with FP16-first KV cache (q8 VRAM fallback), and make a new chat reset the model to genuine zero context.

**Architecture:** Pure prompt-shaping (token-budget trimming) lives in `packages/review-core`. Context-size selection, KV precision + fallback, and session-change reset live in `packages/agent-adapters`. The manifest `defaultContext` in `apps/daemon` is the single source of truth and is threaded into the runtime through the existing adapter construction (`createLocalGemmaAdapter`). Per repo convention, the stateful llama-cli process lifecycle is verified end-to-end; unit tests cover the extracted pure functions (spawn-args builder, ctx/KV resolvers, reuse predicate, VRAM-failure detector, history trimmer).

**Tech Stack:** TypeScript (ESM), npm workspaces, Vitest 4, Zod 4. Workspaces: `@writer/review-core`, `@writer/agent-adapters`, `@writer/daemon`, `@writer/contracts`.

---

## File Structure

- `apps/daemon/src/local-model-manifest.ts` — raise `defaultContext` to 16384 (source of truth).
- `apps/daemon/src/local-model-manifest.test.ts` — **new** guard test for the manifest value.
- `apps/daemon/src/agents.ts` — pass `GEMMA_4_E4B_MANIFEST.defaultContext` into the adapter.
- `packages/review-core/src/copywriter-skill.ts` — add `estimateTokens`, `trimHistoryToBudget`; use a token budget in `buildCopywriterPrompt`.
- `packages/review-core/src/copywriter-skill.test.ts` — tests for the new helpers + budget trimming.
- `packages/agent-adapters/src/adapters/local-gemma-runtime.ts` — ctx-size/KV resolvers, `buildSpawnArgs`, `shouldReuseProcess`, `isVramLoadFailure`, stderr capture, FP16→q8 fallback, `sessionId` on `runTurn`.
- `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts` — tests for the new pure functions.
- `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` — accept `contextSize`, thread it + `sessionId` to the runtime and the cold-spawn args.

---

## Task 1: Manifest default context (source of truth)

**Files:**
- Modify: `apps/daemon/src/local-model-manifest.ts:18`
- Create: `apps/daemon/src/local-model-manifest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/daemon/src/local-model-manifest.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { GEMMA_4_E4B_MANIFEST } from "./local-model-manifest";

describe("GEMMA_4_E4B_MANIFEST", () => {
  it("declares a 16K default context window", () => {
    expect(GEMMA_4_E4B_MANIFEST.defaultContext).toBe(16384);
  });

  it("keeps the default within the model's max context", () => {
    expect(GEMMA_4_E4B_MANIFEST.defaultContext).toBeLessThanOrEqual(
      GEMMA_4_E4B_MANIFEST.modelMaxContext
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/daemon run test -- local-model-manifest`
Expected: FAIL — `expected 8192 to be 16384`.

- [ ] **Step 3: Make the minimal change**

In `apps/daemon/src/local-model-manifest.ts`, change the `defaultContext` line:

```typescript
  modelMaxContext: 131072,
  defaultContext: 16384,
  fileSizeBytes: 8_600_000_000
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/daemon run test -- local-model-manifest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/local-model-manifest.ts apps/daemon/src/local-model-manifest.test.ts
git commit -m "feat(local-gemma): raise manifest defaultContext to 16384"
```

---

## Task 2: Token estimator (review-core)

**Files:**
- Modify: `packages/review-core/src/copywriter-skill.ts`
- Test: `packages/review-core/src/copywriter-skill.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/review-core/src/copywriter-skill.test.ts` (add `estimateTokens` to the existing import from `./copywriter-skill`):

```typescript
describe("estimateTokens", () => {
  it("estimates ~1 token per 4 characters, rounding up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/review-core run test -- copywriter-skill`
Expected: FAIL — `estimateTokens is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `packages/review-core/src/copywriter-skill.ts`, add near the top (after the type declarations):

```typescript
/**
 * Conservative token estimate (no tokenizer dependency). ~1 token per 4 chars,
 * rounded up, so we over-count rather than overflow the context window.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/review-core run test -- copywriter-skill`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/review-core/src/copywriter-skill.ts packages/review-core/src/copywriter-skill.test.ts
git commit -m "feat(review-core): add conservative token estimator"
```

---

## Task 3: Token-budget history trimmer (review-core)

**Files:**
- Modify: `packages/review-core/src/copywriter-skill.ts`
- Test: `packages/review-core/src/copywriter-skill.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/review-core/src/copywriter-skill.test.ts` (add `trimHistoryToBudget` to the import):

```typescript
describe("trimHistoryToBudget", () => {
  const msg = (role: "user" | "assistant", text: string) => ({ role, text });

  it("keeps the newest turns and drops the oldest when over budget", () => {
    const history = [
      msg("user", "AAAAAAAA"),      // 8 chars -> 2 tokens
      msg("assistant", "BBBBBBBB"), // 2 tokens
      msg("user", "CCCCCCCC")       // 2 tokens
    ];
    // Budget for 4 tokens keeps only the last two messages (2 + 2).
    const kept = trimHistoryToBudget(history, 4);
    expect(kept).toEqual([msg("assistant", "BBBBBBBB"), msg("user", "CCCCCCCC")]);
  });

  it("returns chronological order", () => {
    const history = [msg("user", "one"), msg("assistant", "two"), msg("user", "three")];
    const kept = trimHistoryToBudget(history, 1000);
    expect(kept).toEqual(history);
  });

  it("never exceeds the token budget", () => {
    const history = Array.from({ length: 20 }, (_, i) => msg("user", "x".repeat(40)));
    const kept = trimHistoryToBudget(history, 30); // each msg ~10 tokens
    const total = kept.reduce((sum, m) => sum + estimateTokens(m.text), 0);
    expect(total).toBeLessThanOrEqual(30);
  });

  it("drops everything when budget is zero or negative", () => {
    expect(trimHistoryToBudget([msg("user", "hi")], 0)).toEqual([]);
    expect(trimHistoryToBudget([msg("user", "hi")], -5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/review-core run test -- copywriter-skill`
Expected: FAIL — `trimHistoryToBudget is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `packages/review-core/src/copywriter-skill.ts`, add after `estimateTokens`:

```typescript
/**
 * Sliding-window trim: keep the most recent messages whose combined token
 * estimate fits `tokenBudget`, preserving chronological order. Oldest turns are
 * dropped first. Returns [] for a non-positive budget.
 */
export function trimHistoryToBudget(
  history: CopywriterMessage[],
  tokenBudget: number
): CopywriterMessage[] {
  if (tokenBudget <= 0) return [];
  const kept: CopywriterMessage[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const cost = estimateTokens(history[i]!.text);
    if (used + cost > tokenBudget) break;
    used += cost;
    kept.unshift(history[i]!);
  }
  return kept;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/review-core run test -- copywriter-skill`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/review-core/src/copywriter-skill.ts packages/review-core/src/copywriter-skill.test.ts
git commit -m "feat(review-core): add token-budget sliding-window history trim"
```

---

## Task 4: Apply the token budget in buildCopywriterPrompt

**Files:**
- Modify: `packages/review-core/src/copywriter-skill.ts` (type `CopywriterSkillInput`, `buildCopywriterPrompt` around line 171-222, constants near line 52)
- Test: `packages/review-core/src/copywriter-skill.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/review-core/src/copywriter-skill.test.ts` (ensure `buildCopywriterPrompt` is imported):

```typescript
describe("buildCopywriterPrompt token budget", () => {
  it("drops oldest history when a small context window cannot fit it", () => {
    const longTurn = (label: string) => ({ role: "user" as const, text: `${label} ${"word ".repeat(200)}` });
    const prompt = buildCopywriterPrompt({
      userText: "Rewrite: Save changes",
      history: [longTurn("OLDEST"), longTurn("MIDDLE"), longTurn("NEWEST")],
      contextWindow: 1024
    });
    // The newest long turn survives; the oldest is squeezed out by the budget.
    expect(prompt.user).toContain("NEWEST");
    expect(prompt.user).not.toContain("OLDEST");
  });

  it("keeps all history when the window is large", () => {
    const prompt = buildCopywriterPrompt({
      userText: "Rewrite: Save changes",
      history: [
        { role: "user", text: "first question" },
        { role: "assistant", text: "first answer" }
      ],
      contextWindow: 16384
    });
    expect(prompt.user).toContain("first question");
    expect(prompt.user).toContain("first answer");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/review-core run test -- copywriter-skill`
Expected: FAIL — `contextWindow` not accepted / `OLDEST` still present (count-only trim keeps all 3).

- [ ] **Step 3: Write minimal implementation**

In `packages/review-core/src/copywriter-skill.ts`:

1. Add `contextWindow?: number;` to the `CopywriterSkillInput` type (after `history?`).
2. Add constants near `HISTORY_LIMIT` (line 52):

```typescript
const HISTORY_LIMIT = 6;
// Default usable window for the local model; mirrors the manifest defaultContext.
const DEFAULT_CONTEXT_WINDOW = 16384;
// Tokens reserved for the model's reply (matches llama-cli -n 512).
const OUTPUT_RESERVE_TOKENS = 512;
// Slack for estimator error and chat-template overhead.
const SAFETY_MARGIN_TOKENS = 256;
```

3. Replace the history block (currently around lines 213-216):

```typescript
  const history = filterCopywriterHistory(input.history ?? []).slice(-HISTORY_LIMIT);
  if (history.length > 0) {
    const historyLines = history.map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`);
    userSections.push(`Conversation history:\n${historyLines.join("\n")}`);
  }
```

with:

```typescript
  const contextWindow = input.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  // Everything except history is fixed; charge it (plus reply + margin) against
  // the window, then fit as much recent history as the remainder allows.
  const fixedTokens =
    estimateTokens(system) + estimateTokens(userSections.join("\n\n"));
  const historyBudget =
    contextWindow - fixedTokens - OUTPUT_RESERVE_TOKENS - SAFETY_MARGIN_TOKENS;
  const recent = filterCopywriterHistory(input.history ?? []).slice(-HISTORY_LIMIT);
  const history = trimHistoryToBudget(recent, historyBudget);
  if (history.length > 0) {
    const historyLines = history.map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`);
    userSections.push(`Conversation history:\n${historyLines.join("\n")}`);
  }
```

Note: `system` is already computed below the current history block — move the `const system = ...` line (currently ~line 223) to **above** this block so `fixedTokens` can reference it. Keep the existing `const user = userSections.join("\n\n");` after the history push.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/review-core run test -- copywriter-skill`
Expected: PASS (including the pre-existing prompt tests — verify none regressed).

- [ ] **Step 5: Commit**

```bash
git add packages/review-core/src/copywriter-skill.ts packages/review-core/src/copywriter-skill.test.ts
git commit -m "feat(review-core): budget conversation history by context window"
```

---

## Task 5: Context-size & KV-type resolvers + spawn-args builder (runtime)

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`
- Test: `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts` (extend the import to include `resolveCtxSize`, `resolveKvType`, `buildSpawnArgs`):

```typescript
describe("resolveCtxSize", () => {
  it("prefers a valid env override", () => {
    expect(resolveCtxSize("32768", 16384)).toBe(32768);
  });
  it("falls back to the option default when env is invalid or unset", () => {
    expect(resolveCtxSize(undefined, 16384)).toBe(16384);
    expect(resolveCtxSize("not-a-number", 16384)).toBe(16384);
    expect(resolveCtxSize("0", 16384)).toBe(16384);
  });
  it("falls back to 16384 when no option default is given", () => {
    expect(resolveCtxSize(undefined, undefined)).toBe(16384);
  });
});

describe("resolveKvType", () => {
  it("returns the env value when supported", () => {
    expect(resolveKvType("q8_0")).toBe("q8_0");
    expect(resolveKvType("q4_0")).toBe("q4_0");
    expect(resolveKvType("f16")).toBe("f16");
  });
  it("defaults to f16 when unset or unsupported", () => {
    expect(resolveKvType(undefined)).toBe("f16");
    expect(resolveKvType("bogus")).toBe("f16");
  });
});

describe("buildSpawnArgs", () => {
  const base = { modelPath: "/m.gguf", ctxSize: 16384, gpuLayers: "99", system: "" };

  it("carries the resolved ctx-size", () => {
    const args = buildSpawnArgs({ ...base, kvType: "f16" });
    const i = args.indexOf("--ctx-size");
    expect(args[i + 1]).toBe("16384");
  });
  it("omits cache-type flags for f16 (llama.cpp default)", () => {
    const args = buildSpawnArgs({ ...base, kvType: "f16" });
    expect(args).not.toContain("--cache-type-k");
  });
  it("adds cache-type flags for quantized KV", () => {
    const args = buildSpawnArgs({ ...base, kvType: "q8_0" });
    const k = args.indexOf("--cache-type-k");
    const v = args.indexOf("--cache-type-v");
    expect(args[k + 1]).toBe("q8_0");
    expect(args[v + 1]).toBe("q8_0");
  });
  it("appends -sys only when a system prompt is present", () => {
    expect(buildSpawnArgs({ ...base, kvType: "f16" })).not.toContain("-sys");
    expect(buildSpawnArgs({ ...base, kvType: "f16", system: "You are…" })).toContain("-sys");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Write minimal implementation**

In `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`, add after the existing `turnTimeoutMs()` helper:

```typescript
export type KvCacheType = "f16" | "q8_0" | "q4_0";

const DEFAULT_CTX_SIZE = 16384;

/** env override > option default > 16384. Only finite positive integers win. */
export function resolveCtxSize(envValue: string | undefined, optionDefault: number | undefined): number {
  const fromEnv = Number(envValue);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  if (optionDefault && Number.isInteger(optionDefault) && optionDefault > 0) return optionDefault;
  return DEFAULT_CTX_SIZE;
}

/** Supported KV precisions; anything else (incl. unset) means f16. */
export function resolveKvType(envValue: string | undefined): KvCacheType {
  return envValue === "q8_0" || envValue === "q4_0" || envValue === "f16" ? envValue : "f16";
}

/** Pure builder for the llama-cli resident-mode argv. */
export function buildSpawnArgs(input: {
  modelPath: string;
  ctxSize: number;
  gpuLayers: string;
  kvType: KvCacheType;
  system: string;
}): string[] {
  const args = [
    "--model", input.modelPath,
    "--ctx-size", String(input.ctxSize),
    "-ngl", input.gpuLayers,
    "-cnv",
    "--simple-io",
    "--reasoning", "off",
    "-n", "512",
    "--log-disable"
  ];
  if (input.kvType !== "f16") {
    args.push("--cache-type-k", input.kvType, "--cache-type-v", input.kvType);
  }
  if (input.system) {
    args.push("-sys", input.system);
  }
  return args;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-runtime.ts packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts
git commit -m "feat(local-gemma): extract ctx-size/KV resolvers and spawn-args builder"
```

---

## Task 6: Reuse predicate + VRAM-failure detector (runtime)

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`
- Test: `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts` (import `shouldReuseProcess`, `isVramLoadFailure`):

```typescript
describe("shouldReuseProcess", () => {
  const ok = {
    resident: true, currentSystem: "S", system: "S",
    currentSessionId: "c1", sessionId: "c1", turnsHandled: 3, maxTurns: 50
  };
  it("reuses when everything matches", () => {
    expect(shouldReuseProcess(ok)).toBe(true);
  });
  it("restarts on a different conversation (new chat = zero context)", () => {
    expect(shouldReuseProcess({ ...ok, sessionId: "c2" })).toBe(false);
  });
  it("restarts on a system-prompt change", () => {
    expect(shouldReuseProcess({ ...ok, system: "OTHER" })).toBe(false);
  });
  it("restarts when the turn budget is exhausted", () => {
    expect(shouldReuseProcess({ ...ok, turnsHandled: 50 })).toBe(false);
  });
  it("restarts when no process is resident", () => {
    expect(shouldReuseProcess({ ...ok, resident: false })).toBe(false);
  });
});

describe("isVramLoadFailure", () => {
  it("detects common CUDA/alloc out-of-memory signatures", () => {
    expect(isVramLoadFailure("ggml_cuda: out of memory")).toBe(true);
    expect(isVramLoadFailure("failed to allocate CUDA0 buffer")).toBe(true);
    expect(isVramLoadFailure("cudaMalloc failed: out of memory")).toBe(true);
  });
  it("ignores unrelated errors", () => {
    expect(isVramLoadFailure("model file not found")).toBe(false);
    expect(isVramLoadFailure("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`:

```typescript
/** Pure decision: may we reuse the resident process for this turn? */
export function shouldReuseProcess(input: {
  resident: boolean;
  currentSystem: string | null;
  system: string;
  currentSessionId: string | null;
  sessionId: string;
  turnsHandled: number;
  maxTurns: number;
}): boolean {
  return (
    input.resident &&
    input.currentSystem === input.system &&
    input.currentSessionId === input.sessionId &&
    input.turnsHandled < input.maxTurns
  );
}

/** Heuristic: does this llama-cli stderr indicate a VRAM allocation failure? */
export function isVramLoadFailure(stderr: string): boolean {
  return /out of memory|failed to allocate|cudamalloc|cuda error|vram/i.test(stderr);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-runtime.ts packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts
git commit -m "feat(local-gemma): add process-reuse predicate and VRAM-failure detector"
```

---

## Task 7: Wire resolvers, KV fallback, and session reset into the runtime

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-runtime.ts` (class internals: `LocalGemmaRuntimeOptions`, fields, `spawnProcess`, `waitForReady`, `ensureProcess`, `runTurn`)

This task wires the pure helpers into the stateful class. Per repo convention (see the comment atop `local-gemma-runtime.test.ts`), the process lifecycle is verified end-to-end in Task 10, not unit-mocked. There is no new unit test here; correctness of the extracted logic is already covered by Tasks 5–6.

- [ ] **Step 1: Extend options and fields**

In `LocalGemmaRuntimeOptions` add:

```typescript
export type LocalGemmaRuntimeOptions = {
  binary: string;
  modelPath: string;
  gpuLayers: string;
  contextSize?: number;
};
```

Add fields to the class (next to `private currentSystem`):

```typescript
  private currentSessionId: string | null = null;
  private kvType: KvCacheType = resolveKvType(process.env["WRITER_LOCAL_KV_TYPE"]);
  private kvFallbackUsed = false;
  private stderrBuf = "";
  // True when the user pinned a precision (disables auto FP16->q8 fallback).
  private readonly kvPinned = process.env["WRITER_LOCAL_KV_TYPE"] !== undefined;
```

- [ ] **Step 2: Use the spawn-args builder and capture stderr**

Replace the body of `spawnProcess(system)` so it uses `buildSpawnArgs` and records the session + a stderr listener:

```typescript
  private spawnProcess(system: string, sessionId: string): void {
    const { binary, modelPath, gpuLayers, contextSize } = this.opts;
    const ctxSize = resolveCtxSize(process.env["WRITER_LOCAL_CTX_SIZE"], contextSize);
    const args = buildSpawnArgs({ modelPath, ctxSize, gpuLayers, kvType: this.kvType, system });
    const child = spawn(binary, args, { cwd: dirname(binary), stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    this.stderrBuf = "";
    child.stdout.on("data", (chunk: string) => { this.stdoutBuf += chunk; });
    child.stderr.on("data", (chunk: string) => { this.stderrBuf += chunk; });
    child.on("exit", () => {
      if (this.child === child) {
        this.child = null;
        this.currentSystem = null;
        this.currentSessionId = null;
        this.stdoutBuf = "";
      }
    });
    this.child = child;
    this.currentSystem = system;
    this.currentSessionId = sessionId;
    this.stdoutBuf = "";
  }
```

Also clear `currentSessionId` in `evict()` alongside `currentSystem`.

- [ ] **Step 3: Add the FP16→q8 fallback in ensureProcess**

Rewrite `ensureProcess` to take `sessionId`, use `shouldReuseProcess`, and retry once with `q8_0` on a VRAM load failure:

```typescript
  private async ensureProcess(system: string, sessionId: string): Promise<void> {
    if (
      shouldReuseProcess({
        resident: this.resident,
        currentSystem: this.currentSystem,
        system,
        currentSessionId: this.currentSessionId,
        sessionId,
        turnsHandled: this.turnsHandled,
        maxTurns: LocalGemmaRuntime.MAX_TURNS
      })
    ) {
      return;
    }
    if (this.resident) this.evict();
    this.turnsHandled = 0;
    this.spawnProcess(system, sessionId);
    try {
      await this.waitForReady(turnTimeoutMs());
    } catch (err) {
      // Retry once at q8 KV if FP16 could not fit in VRAM and no pin is set.
      if (!this.kvPinned && !this.kvFallbackUsed && this.kvType === "f16" && isVramLoadFailure(this.stderrBuf)) {
        this.kvFallbackUsed = true;
        this.kvType = "q8_0";
        if (this.resident) this.evict();
        this.spawnProcess(system, sessionId);
        await this.waitForReady(turnTimeoutMs());
        return;
      }
      throw err;
    }
  }
```

- [ ] **Step 4: Thread sessionId through runTurn**

Change the `runTurn` signature and its `ensureProcess` call:

```typescript
  async runTurn(system: string, userText: string, sessionId: string): Promise<string> {
    await this.acquire();
    try {
      await this.ensureProcess(system, sessionId);
      // …unchanged body…
```

- [ ] **Step 5: Typecheck**

Run: `npm --workspace @writer/agent-adapters run typecheck`
Expected: PASS. (Adapter call site updates in Task 8 — a temporary type error there is expected until then; if you run a full `typecheck` now, it will flag `local-gemma-adapter.ts`. Proceed to Task 8.)

- [ ] **Step 6: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-runtime.ts
git commit -m "feat(local-gemma): session-keyed restart and FP16->q8 KV fallback"
```

---

## Task 8: Thread context size & sessionId through the adapter

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`

- [ ] **Step 1: Accept contextSize in adapter options**

Update `LocalGemmaAdapterOptions`:

```typescript
export type LocalGemmaAdapterOptions = {
  getModelState: () => LocalModelState | null;
  contextSize?: number;
};
```

- [ ] **Step 2: Pass contextSize into the resident runtime**

Update `getResidentRuntime` and its caller to carry `contextSize`:

```typescript
function getResidentRuntime(binary: string, modelPath: string, contextSize?: number): LocalGemmaRuntime {
  if (!residentRuntime) {
    residentRuntime = new LocalGemmaRuntime({ binary, modelPath, gpuLayers: getGpuLayers(), contextSize });
  }
  return residentRuntime;
}
```

Thread `contextSize` from `run(...)` → `tryRunResident(...)` → `getResidentRuntime(...)`. Add a `contextSize?: number` parameter to `tryRunResident` and to `run`'s internal flow (read it from the adapter options).

- [ ] **Step 3: Pass sessionId to runTurn**

In `tryRunResident`, change the call to:

```typescript
    response = await runtime.runTurn(system, user, request.sessionId);
```

- [ ] **Step 4: Use the resolver for the cold-spawn fallback**

In the cold-spawn `args` array (the `run` function), replace the hardcoded line:

```typescript
    "--ctx-size", "4096",
```

with a resolved value and KV flags consistent with the runtime. Near the top of the cold-spawn block:

```typescript
  const ctxSize = resolveCtxSize(process.env["WRITER_LOCAL_CTX_SIZE"], options.contextSize);
  const kvType = resolveKvType(process.env["WRITER_LOCAL_KV_TYPE"]);
```

and build the args via the shared builder where practical, or at minimum:

```typescript
    "--ctx-size", String(ctxSize),
```

and, when `kvType !== "f16"`, push `"--cache-type-k", kvType, "--cache-type-v", kvType` into the cold-spawn args. Import `resolveCtxSize`, `resolveKvType` from `./local-gemma-runtime`. (The cold-spawn path uses `--single-turn`, so it does not need session tracking.)

- [ ] **Step 5: Wire options through createLocalGemmaAdapter**

In `createLocalGemmaAdapter`, pass `options.contextSize` down to `run` (e.g. capture `options` in the returned `run` closure so `run` can read `options.contextSize`).

- [ ] **Step 6: Typecheck + tests**

Run: `npm --workspace @writer/agent-adapters run typecheck && npm --workspace @writer/agent-adapters run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-adapter.ts
git commit -m "feat(local-gemma): thread context size and sessionId into runtime + cold spawn"
```

---

## Task 9: Daemon supplies the manifest context size

**Files:**
- Modify: `apps/daemon/src/agents.ts:72-74`

- [ ] **Step 1: Pass defaultContext when constructing the adapter**

Ensure `GEMMA_4_E4B_MANIFEST` is imported in `agents.ts` (add `import { GEMMA_4_E4B_MANIFEST } from "./local-model-manifest";` if absent), then:

```typescript
    createLocalGemmaAdapter({
      getModelState: () => state.store.getLocalModel(),
      contextSize: GEMMA_4_E4B_MANIFEST.defaultContext
    })
```

- [ ] **Step 2: Typecheck**

Run: `npm --workspace @writer/daemon run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/daemon/src/agents.ts
git commit -m "feat(daemon): pass manifest defaultContext to local Gemma adapter"
```

---

## Task 10: Full verification

**Files:** none (validation only)

- [ ] **Step 1: Repo-wide typecheck and tests**

Run: `npm run typecheck && npm run test`
Expected: PASS across all workspaces.

- [ ] **Step 2: Validate the OpenSpec change**

Run: `npx openspec validate expand-local-context-window --type change --strict`
Expected: `Change 'expand-local-context-window' is valid`.

- [ ] **Step 3: Manual smoke (live daemon + GPU)**

1. Launch the app, open a Local Gemma chat.
2. Send 15–20 messages (or paste several long blocks). Confirm it no longer errors at the old 4096 boundary.
3. Click **New Chat**, ask the model to repeat anything from the previous chat. Confirm it has no prior-chat context.
4. With `WRITER_LOCAL_KV_TYPE` unset, confirm tok/s stays ~50 (FP16 at 16K). Note in the change's verify notes whether the q8 fallback engaged (check daemon logs / VRAM).

- [ ] **Step 4: Mark tasks complete in tasks.md and commit**

```bash
git add openspec/changes/expand-local-context-window/tasks.md
git commit -m "chore(openspec): mark expand-local-context-window tasks complete"
```

---

## Self-Review Notes

- **Spec coverage:** ctx-from-manifest (Tasks 1, 5, 8, 9), env override (Task 5), KV FP16→q8 fallback + pin (Tasks 5–7), new-chat reset (Tasks 6–8), token-budget trimming + overflow-never-fails (Tasks 2–4). All `agent-adapter-runtime` and `paste-text-chat` delta scenarios map to a task.
- **Type consistency:** `KvCacheType`, `resolveCtxSize`, `resolveKvType`, `buildSpawnArgs`, `shouldReuseProcess`, `isVramLoadFailure`, `trimHistoryToBudget`, `estimateTokens`, and the `contextSize`/`contextWindow` option names are used identically across tasks.
- **Process lifecycle testing:** intentionally end-to-end (Task 10) per the existing runtime-test note; extracted pure functions carry the unit coverage.
