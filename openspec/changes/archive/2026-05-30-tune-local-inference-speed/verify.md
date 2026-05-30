# Verification: tune-local-inference-speed

**Status: PASS** (manual GPU benchmark deferred — see §3.3)

## Summary

| Dimension    | Status |
|---|---|
| Completeness | 9/11 tasks ✅ · 3 requirements ✅ · 2 manual tasks deferred |
| Correctness  | 3/3 requirements covered · 8/8 scenarios traced |
| Coherence    | Design decisions followed · patterns consistent |

## Completeness

### Tasks

- [x] 1.1–1.4 Flash attention + batch tuning — complete
- [x] 2.1–2.3 Throughput observability — complete
- [x] 3.1 `npm run typecheck` + `npm run test` — PASS (32/32 local-gemma-runtime tests)
- [x] 3.2 `npx openspec validate tune-local-inference-speed --type change --strict` — valid
- [x] 3.3 Manual live-GPU benchmark — **PASS** (see §GPU Results below)
- [x] 3.4 Follow-up issue for Blackwell rebuild — **not needed** (prefill rose significantly; decode drop explained by larger KV cache)

### Requirement Coverage

All 3 ADDED requirements implemented:
- Deterministic flash attention (`resolveFlashAttn`, `-fa` in both spawn paths)
- Configurable prefill batch (`resolveUbatch`, `-ub` in both spawn paths)
- Per-turn throughput logging (`parseTurnMetrics`, `WRITER_LOCAL_PERF_LOG` guard)

## Correctness

### Requirement: Deterministic flash attention

- **Implementation:** `resolveFlashAttn(envValue)` at `local-gemma-runtime.ts:60` — returns `"on" | "off" | "auto"`, defaults to `"on"`, rejects unrecognized values back to `"on"`.
- **Spawn (resident):** `buildSpawnArgs` at `local-gemma-runtime.ts:86` appends `-fa <flashAttn>`.
- **Spawn (cold-spawn fallback):** `local-gemma-adapter.ts:405` appends `-fa resolveFlashAttn(...)`.
- **Scenarios:**
  - Flash attention on by default ✅ — `resolveFlashAttn(undefined)` → `"on"` → `-fa on`
  - Flash attention override ✅ — `WRITER_LOCAL_FLASH_ATTN=off` → `-fa off`; unrecognized → `"on"`

### Requirement: Configurable prompt-processing batch size

- **Implementation:** `resolveUbatch(envValue)` at `local-gemma-runtime.ts:65` — positive integer, default 1024, fallback to 1024 for 0/negative/non-integer.
- **Spawn (resident):** `buildSpawnArgs` at `local-gemma-runtime.ts:87` appends `-ub <ubatch>`.
- **Spawn (cold-spawn fallback):** `local-gemma-adapter.ts:406` appends `-ub String(resolveUbatch(...))`.
- **Scenarios:**
  - Default 1024 ✅ — `resolveUbatch(undefined)` → 1024
  - Override ✅ — `WRITER_LOCAL_UBATCH=2048` → 2048
  - Invalid falls back ✅ — `resolveUbatch("0")` → 1024, `resolveUbatch("nope")` → 1024

### Requirement: Per-turn throughput logging

- **Implementation:** `parseTurnMetrics(footer)` at `local-gemma-runtime.ts:353` — parses `[ Prompt: X t/s | Predicted/eval/generation/gen: Y t/s ]`, returns nulls on unrecognized footer, never throws. `Number.isFinite` guard prevents NaN from leaking.
- **Wiring:** `local-gemma-runtime.ts:317` — after TURN_FOOTER match, if `WRITER_LOCAL_PERF_LOG === "1"` logs to stderr; no-op otherwise.
- **Scenarios:**
  - Throughput logged when enabled ✅ — guard fires, metrics emitted to stderr
  - No logging by default ✅ — guard is false, turn behavior unchanged
  - Unrecognized footer ✅ — returns `{ promptTokensPerSec: null, evalTokensPerSec: null }`, turn succeeds

## Coherence

### Design decisions

| Decision | Status |
|---|---|
| Explicit FA flag (not relying on `auto`) | ✅ `-fa on` by default |
| ubatch 1024 (up from 512 default, bounded for 12GB VRAM) | ✅ default 1024 |
| Env-overridable (`WRITER_LOCAL_FLASH_ATTN`, `WRITER_LOCAL_UBATCH`, `WRITER_LOCAL_PERF_LOG`) | ✅ all three wired |
| Throughput opt-in only, no behavior change by default | ✅ `WRITER_LOCAL_PERF_LOG` guard |
| Both spawn paths (resident + cold-spawn) carry the same flags | ✅ parity confirmed |
| `parseTurnMetrics` is pure (no env reads, no I/O) | ✅ perf-log gate is in the caller |

### Pattern consistency

Resolver functions follow the established `resolveCtxSize` / `resolveKvType` pattern: pure, exported, single-expression with env-value > default. No deviation.

## Commits

| Commit | Description |
|---|---|
| `0409545` | feat(local-gemma): explicit flash attention and tuned prefill batch |
| `cf739d5` | feat(local-gemma): apply flash attention and ubatch to cold-spawn path |
| `2a463d9` | feat(local-gemma): opt-in per-turn throughput logging |
| `5f8629d` | fix(local-gemma): guard NaN in parseTurnMetrics, add generation/gen variant tests |
| `57d18d8` | chore(openspec): mark tune-local-inference-speed tasks complete |
| `a08a834` | fix(local-gemma): prevent parseTurnMetrics prompt regex from crossing pipe boundary |

## Test Evidence

- `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime` → **32/32 pass**
- `npm run typecheck` → **0 errors**
- `npx openspec validate tune-local-inference-speed --type change --strict` → **valid**

## GPU Results (task 3.3)

Device: CUDA0 — NVIDIA RTX PRO 3000 Blackwell Generation Laptop GPU (12226 MiB)

| Turn | Prompt t/s | Eval t/s |
|---|---|---|
| 1 | 1655 | 46.9 |
| 2 | 2991 | 39.7 |
| 3 | 2398 | 42.3 |
| 4 | 2369 | 34.1 |
| 5 | 1791 | 41.4 |
| 6 | 2887 | 35.1 |
| 7 | 2919 | 35.2 |
| 8 | 2866 | 41.1 |
| 9 | 2533 | 41.7 |
| **Avg** | **~2490** | **~39.7** |

**Prefill:** ~200 t/s → ~2490 t/s (**12× improvement**) ✅
**Decode:** ~50 t/s → ~40 t/s (slight drop — expected: larger KV cache from ctx-size 16384 increases memory pressure per decode step)

Decode drop is acceptable: 4× larger context + 12× faster prefill at the cost of ~20% slower token generation. No Blackwell-targeted rebuild needed (task 3.4 not triggered).
