# Tasks: NVIDIA GPU-Only Inference

## 1. Contracts

- [x] 1.1 Add `"gpu_not_available"` to `ConnectionDiagnosticCode` union in `packages/contracts/src/connection-diagnostic.ts`
- [x] 1.2 Run `npm run typecheck --workspace @writer/contracts` — must pass

## 2. GPU Detection Helper

- [x] 2.1 Add `detectNvidiaGpu(): Promise<boolean>` helper in `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` using `spawn("nvidia-smi")` exit code check
- [x] 2.2 Honor `WRITER_GPU_LAYERS` env var: if set (any value), skip the `nvidia-smi` check
- [ ] 2.3 Add unit tests for `detectNvidiaGpu` in `packages/agent-adapters/src/adapters/local-gemma-adapter.test.ts` (or nearest test file) — mock `spawn` to simulate GPU present/absent

## 3. Adapter: detect() and run()

- [x] 3.1 In `detect()`, after binary + model checks pass, call `detectNvidiaGpu()`; return `available: false` with `gpu_not_available` diagnostic if GPU absent
- [x] 3.2 In `run()`, insert `"--ngl"` and `getGpuLayers()` into the spawn args array
- [ ] 3.3 Update adapter unit tests to assert `--ngl 99` is in spawn args and that GPU-absent detection blocks the run

## 4. Verification

- [x] 4.1 Run `npm run typecheck` — clean
- [x] 4.2 Run `npm run test` — pre-existing failures only (echo adapter + cli-runner Windows issues unrelated to this change)
