## 1. Flash attention + batch tuning (agent-adapters runtime)

- [x] 1.1 Add `resolveFlashAttn(env)` (→ `on` | `off` | `auto`, default `on`) and `resolveUbatch(env)` (→ positive int, default 1024) pure helpers in `local-gemma-runtime.ts`.
- [x] 1.2 Extend `buildSpawnArgs` (from `expand-local-context-window`) to append `-fa <flashAttn>` and `-ub <ubatch>`.
- [x] 1.3 Apply the same `-fa`/`-ub` flags on the cold-spawn fallback in `local-gemma-adapter.ts`.
- [x] 1.4 Unit tests: `buildSpawnArgs` carries `-fa on` and `-ub 1024` by default; env overrides respected; invalid values fall back to defaults.

## 2. Throughput observability (agent-adapters runtime)

- [x] 2.1 Add pure `parseTurnMetrics(footer)` returning `{ promptTokensPerSec, evalTokensPerSec }` (nulls on unrecognized footer) from llama-cli's `[ Prompt: … t/s ]` footer.
- [x] 2.2 When `WRITER_LOCAL_PERF_LOG=1`, log the parsed metrics per turn; no-op when unset.
- [x] 2.3 Unit tests: parse a real footer sample, tolerate CRLF and missing fields, return nulls on garbage.

## 3. Verification

- [x] 3.1 `npm run typecheck` and `npm run test` pass.
- [x] 3.2 `npx openspec validate tune-local-inference-speed --type change --strict` → valid.
- [ ] 3.3 Manual (live GPU): with `WRITER_LOCAL_PERF_LOG=1`, record prompt-eval and eval tok/s before vs after; confirm prefill rises, decode unchanged-or-better, and the banner shows `flash_attn = 1` on the CUDA0 Blackwell device.
- [ ] 3.4 If prefill stays low after `-ub` tuning, open a follow-up issue for a Blackwell-targeted (`sm_120`, CUDA 12.8) llama.cpp rebuild.
