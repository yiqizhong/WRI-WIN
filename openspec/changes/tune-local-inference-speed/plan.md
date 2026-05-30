# Tune Local Inference Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply no-quality-loss tuning to the Local Gemma runtime — deterministic flash attention, a larger prefill batch, and opt-in per-turn throughput logging — to speed up prompt processing and measure decode.

**Architecture:** All changes live in `packages/agent-adapters` and extend the `buildSpawnArgs` helper introduced by the `expand-local-context-window` change. New behavior is gated by `WRITER_LOCAL_*` env vars (matching the existing convention) so defaults are safe and values are benchmarkable. Throughput is parsed from llama-cli's per-turn footer by a pure function and logged only when opted in.

**Tech Stack:** TypeScript (ESM), npm workspaces, Vitest 4. Workspace: `@writer/agent-adapters`.

> **DEPENDENCY:** This plan assumes `expand-local-context-window` has landed. It relies on `buildSpawnArgs` and the `KvCacheType` type existing in `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`. If that change is not yet merged, land it first.

---

## File Structure

- `packages/agent-adapters/src/adapters/local-gemma-runtime.ts` — add `resolveFlashAttn`, `resolveUbatch`, `parseTurnMetrics`; extend `buildSpawnArgs` input with `flashAttn` + `ubatch`; emit metrics when the perf-log flag is set.
- `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts` — tests for the new pure functions.
- `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` — apply `-fa`/`-ub` to the cold-spawn fallback.

---

## Task 1: Flash-attention and ubatch resolvers + spawn args

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`
- Test: `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `local-gemma-runtime.test.ts` (extend the import with `resolveFlashAttn`, `resolveUbatch`, and reuse the existing `buildSpawnArgs` import):

```typescript
describe("resolveFlashAttn", () => {
  it("defaults to on", () => {
    expect(resolveFlashAttn(undefined)).toBe("on");
  });
  it("accepts on/off/auto", () => {
    expect(resolveFlashAttn("off")).toBe("off");
    expect(resolveFlashAttn("auto")).toBe("auto");
    expect(resolveFlashAttn("on")).toBe("on");
  });
  it("falls back to on for unrecognized values", () => {
    expect(resolveFlashAttn("yes")).toBe("on");
  });
});

describe("resolveUbatch", () => {
  it("defaults to 1024", () => {
    expect(resolveUbatch(undefined)).toBe(1024);
  });
  it("accepts a valid positive integer", () => {
    expect(resolveUbatch("2048")).toBe(2048);
  });
  it("falls back to 1024 for invalid values", () => {
    expect(resolveUbatch("0")).toBe(1024);
    expect(resolveUbatch("nope")).toBe(1024);
  });
});

describe("buildSpawnArgs flash-attn + ubatch", () => {
  const base = { modelPath: "/m.gguf", ctxSize: 16384, gpuLayers: "99", kvType: "f16" as const, system: "" };

  it("carries -fa and -ub with defaults", () => {
    const args = buildSpawnArgs({ ...base, flashAttn: "on", ubatch: 1024 });
    expect(args[args.indexOf("-fa") + 1]).toBe("on");
    expect(args[args.indexOf("-ub") + 1]).toBe("1024");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: FAIL — `resolveFlashAttn is not a function` / `buildSpawnArgs` ignores `flashAttn`.

- [ ] **Step 3: Write minimal implementation**

In `local-gemma-runtime.ts`, add after the `resolveKvType` helper:

```typescript
export type FlashAttn = "on" | "off" | "auto";

const DEFAULT_UBATCH = 1024;

/** env value > default 'on'. Only on/off/auto are valid. */
export function resolveFlashAttn(envValue: string | undefined): FlashAttn {
  return envValue === "on" || envValue === "off" || envValue === "auto" ? envValue : "on";
}

/** env value > default 1024. Only finite positive integers win. */
export function resolveUbatch(envValue: string | undefined): number {
  const n = Number(envValue);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_UBATCH;
}
```

Then extend `buildSpawnArgs`. Change its input type to add the two fields and append the flags (place them before the conditional KV/system pushes):

```typescript
export function buildSpawnArgs(input: {
  modelPath: string;
  ctxSize: number;
  gpuLayers: string;
  kvType: KvCacheType;
  flashAttn: FlashAttn;
  ubatch: number;
  system: string;
}): string[] {
  const args = [
    "--model", input.modelPath,
    "--ctx-size", String(input.ctxSize),
    "-ngl", input.gpuLayers,
    "-cnv",
    "--simple-io",
    "--reasoning", "off",
    "-fa", input.flashAttn,
    "-ub", String(input.ubatch),
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

- [ ] **Step 4: Update the runtime's spawn call site**

In `spawnProcess` (where `buildSpawnArgs(...)` is called — from the dependency change), pass the two new fields:

```typescript
    const args = buildSpawnArgs({
      modelPath,
      ctxSize,
      gpuLayers,
      kvType: this.kvType,
      flashAttn: resolveFlashAttn(process.env["WRITER_LOCAL_FLASH_ATTN"]),
      ubatch: resolveUbatch(process.env["WRITER_LOCAL_UBATCH"]),
      system
    });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: PASS. Also run the prior change's `buildSpawnArgs` tests — update those call sites to include `flashAttn: "on", ubatch: 1024` so they still compile.

- [ ] **Step 6: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-runtime.ts packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts
git commit -m "feat(local-gemma): explicit flash attention and tuned prefill batch"
```

---

## Task 2: Apply -fa/-ub to the cold-spawn fallback

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`

- [ ] **Step 1: Add the flags to the cold-spawn args**

In the cold-spawn `args` array in `run(...)` (which the dependency change updated for ctx-size/KV), import `resolveFlashAttn`, `resolveUbatch` from `./local-gemma-runtime` and insert near the other flags:

```typescript
    "-fa", resolveFlashAttn(process.env["WRITER_LOCAL_FLASH_ATTN"]),
    "-ub", String(resolveUbatch(process.env["WRITER_LOCAL_UBATCH"])),
```

- [ ] **Step 2: Typecheck + tests**

Run: `npm --workspace @writer/agent-adapters run typecheck && npm --workspace @writer/agent-adapters run test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-adapter.ts
git commit -m "feat(local-gemma): apply flash attention and ubatch to cold-spawn path"
```

---

## Task 3: Per-turn throughput parser + opt-in logging

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`
- Test: `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `local-gemma-runtime.test.ts` (import `parseTurnMetrics`):

```typescript
describe("parseTurnMetrics", () => {
  it("extracts prompt and generation tokens/sec from a footer", () => {
    const footer = "[ Prompt: 210.34 t/s | Predicted: 52.10 t/s ]";
    expect(parseTurnMetrics(footer)).toEqual({
      promptTokensPerSec: 210.34,
      evalTokensPerSec: 52.1
    });
  });
  it("tolerates eval/generation wording and CRLF", () => {
    const footer = "\r\n[ Prompt: 180 t/s | eval: 49.5 t/s ]\r\n";
    expect(parseTurnMetrics(footer)).toEqual({
      promptTokensPerSec: 180,
      evalTokensPerSec: 49.5
    });
  });
  it("returns nulls when the footer is unrecognized", () => {
    expect(parseTurnMetrics("no numbers here")).toEqual({
      promptTokensPerSec: null,
      evalTokensPerSec: null
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: FAIL — `parseTurnMetrics is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `local-gemma-runtime.ts`, add:

```typescript
export type TurnMetrics = {
  promptTokensPerSec: number | null;
  evalTokensPerSec: number | null;
};

/**
 * Parse llama-cli's per-turn footer, e.g.
 *   "[ Prompt: 210.34 t/s | Predicted: 52.10 t/s ]"
 * Generation rate may be labelled Predicted / eval / generation. Returns nulls
 * for any field that is not present; never throws.
 */
export function parseTurnMetrics(footer: string): TurnMetrics {
  const num = (re: RegExp): number | null => {
    const m = re.exec(footer);
    return m ? Number(m[1]) : null;
  };
  return {
    promptTokensPerSec: num(/prompt[^\]]*?([\d.]+)\s*t\/s/i),
    evalTokensPerSec: num(/(?:predicted|eval|generation|gen)[^\]]*?([\d.]+)\s*t\/s/i)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: PASS.

- [ ] **Step 5: Emit metrics behind the perf-log flag**

In `waitForTurnFooter` (the dependency/base code that slices the footer out of the buffer), capture the matched footer text and, when the flag is set, log parsed metrics. At the point where the footer match `m` is found and before returning the slice:

```typescript
      if (process.env["WRITER_LOCAL_PERF_LOG"] === "1") {
        const metrics = parseTurnMetrics(m[0]);
        console.error(
          `[local-gemma] prompt ${metrics.promptTokensPerSec ?? "?"} t/s, ` +
          `eval ${metrics.evalTokensPerSec ?? "?"} t/s`
        );
      }
```

(`m[0]` is the matched footer; this runs only when `WRITER_LOCAL_PERF_LOG=1`, so default behavior is unchanged.)

- [ ] **Step 6: Typecheck + tests**

Run: `npm --workspace @writer/agent-adapters run typecheck && npm --workspace @writer/agent-adapters run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-runtime.ts packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts
git commit -m "feat(local-gemma): opt-in per-turn throughput logging"
```

---

## Task 4: Full verification

**Files:** none (validation only)

- [ ] **Step 1: Repo-wide typecheck and tests**

Run: `npm run typecheck && npm run test`
Expected: PASS across all workspaces.

- [ ] **Step 2: Validate the OpenSpec change**

Run: `npx openspec validate tune-local-inference-speed --type change --strict`
Expected: `Change 'tune-local-inference-speed' is valid`.

- [ ] **Step 3: Manual benchmark (live GPU)**

1. Set `WRITER_LOCAL_PERF_LOG=1`. Run a few chat turns; record the logged prompt and eval t/s as the baseline-after-tuning.
2. Compare to the pre-change baseline (~200 prompt t/s, ~50 eval t/s). Expect prompt (prefill) t/s to rise meaningfully; eval t/s roughly unchanged-to-slightly-better (Q8 is bandwidth-bound at ~78 t/s ceiling).
3. Temporarily remove `--log-disable` once and confirm the startup banner shows the CUDA0 Blackwell device with `flash_attn = 1`.

- [ ] **Step 4: Follow-up if prefill is still low**

If prompt t/s stays low after `-ub` tuning, open a follow-up issue for a Blackwell-targeted (`sm_120`, CUDA 12.8) llama.cpp rebuild — out of scope for this change.

- [ ] **Step 5: Mark tasks complete and commit**

```bash
git add openspec/changes/tune-local-inference-speed/tasks.md
git commit -m "chore(openspec): mark tune-local-inference-speed tasks complete"
```

---

## Self-Review Notes

- **Spec coverage:** deterministic flash attention + override (Task 1), prefill batch default 1024 + override + invalid fallback (Task 1), cold-spawn parity (Task 2), per-turn throughput logging on/off/unrecognized-footer (Task 3). All three `agent-adapter-runtime` ADDED requirements map to tasks.
- **Placeholder scan:** none — all steps carry real code and exact commands.
- **Type consistency:** `FlashAttn`, `resolveFlashAttn`, `resolveUbatch`, `parseTurnMetrics`, `TurnMetrics`, and the extended `buildSpawnArgs` input (`flashAttn`, `ubatch`) are used identically across tasks.
- **Dependency:** extends `expand-local-context-window`'s `buildSpawnArgs`/`KvCacheType`; call sites from that change are updated in Task 1 Step 5.
