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
- [x] 3.2 In `run()`, insert `"-ngl"` (single dash — `--ngl` is rejected by this llama.cpp build) and `getGpuLayers()` into the spawn args array
- [x] 3.3 Set `cwd: dirname(binary)` on spawn so Windows finds sibling DLLs (ggml-cuda.dll, cudart, cublas) at load time
- [ ] 3.4 Update adapter unit tests to assert `-ngl 99` is in spawn args and that GPU-absent detection blocks the run

## 4. CUDA runtime (the actual root cause)

- [x] 4.1 Diagnose: ggml-cuda.dll fails LoadLibrary with error 126 — missing cudart64_12.dll + cublas64_12.dll/cublasLt64_12.dll (NVIDIA driver ships nvcuda.dll but not the CUDA *runtime*)
- [x] 4.2 Detect via `llama-cli --list-devices` (stronger than nvidia-smi: exercises the real backend-load path) — empty list ⇒ `gpu_not_available`
- [x] 4.3 Add `scripts/install-cuda-runtime.sh` to fetch the 3 CUDA 12 redist DLLs into the llama folder
- [ ] 4.4 Bundle CUDA redist DLLs in app packaging (deferred — no electron-builder config exists yet)

## 5. Verification

- [x] 5.1 Run `npm run typecheck` — clean
- [x] 5.2 Direct GPU proof: `llama-cli --list-devices` shows `CUDA0: NVIDIA RTX PRO 3000`; inference ran at 57 tok/s with nvidia-smi showing 95% GPU util, 5.6GB VRAM, llama-cli as a CUDA compute process
