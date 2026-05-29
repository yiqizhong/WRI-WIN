# Design: NVIDIA GPU-Only Inference

## Context

The local Gemma adapter (`packages/agent-adapters/src/adapters/local-gemma-adapter.ts`)
spawns `llama-cli` without GPU layer offload flags. llama.cpp defaults to CPU-only
inference when `-ngl` is absent, producing empty or timed-out responses on the 8.6 GB
Q8_0 model. The target hardware is NVIDIA RTX workstations (≥12 GB VRAM).

The user requirement is strict: inference must run **exclusively on NVIDIA GPU**.
CPU fallback is not acceptable — if an NVIDIA GPU is not available the adapter must
report unavailable with a clear diagnostic rather than silently degrading.

## Goals / Non-Goals

**Goals:**
- Add `-ngl 99` to llama-cli spawn args so all transformer layers offload to NVIDIA GPU.
- Detect NVIDIA GPU presence in `detect()` before reporting the adapter as available.
- Fail fast with a clear diagnostic if NVIDIA GPU is absent.
- Honor `WRITER_GPU_LAYERS` env var for dev/CI override.
- Add `gpu_not_available` diagnostic code to contracts.

**Non-Goals:**
- Partial offload (mixed CPU+GPU layers).
- AMD or Intel GPU support.
- macOS Metal path (separate concern).
- GPU tuning UI.
- Automatic CUDA backend selection (caller must supply a CUDA-built llama-cli).

## Decisions

### D0: Real root cause — missing CUDA 12 runtime (added after dogfood)

- **Finding:** The "empty rewrite" was NOT primarily a missing `-ngl` flag. The
  bundled `ggml-cuda.dll` fails to load with Windows error 126
  (ERROR_MOD_NOT_FOUND) because its dependencies `cudart64_12.dll`,
  `cublas64_12.dll`, and `cublasLt64_12.dll` are absent. The NVIDIA driver provides
  `nvcuda.dll` (driver API) but not the CUDA *runtime* libraries.
- **Consequence:** llama.cpp silently loads zero GPU backends and runs on CPU.
- **Fix:** Ship the 3 CUDA 12 redist DLLs next to `llama-cli.exe`
  (`scripts/install-cuda-runtime.sh` for now; app bundling later).
- **Secondary bug:** the flag must be `-ngl` (single dash); this build rejects
  `--ngl`. And the spawn needs `cwd: dirname(binary)` so Windows resolves the
  sibling CUDA DLLs at load time.

### D1: Detect GPU via `llama-cli --list-devices`, not `nvidia-smi`

- **Choice:** Run `llama-cli --list-devices` and require a non-CPU device line.
- **Rationale:** `nvidia-smi` only proves a driver exists — it passes even when the
  CUDA *backend* can't load (the exact failure here). `--list-devices` exercises the
  real backend-load path inference uses, so it catches a present-but-unloadable
  CUDA backend and prevents silent CPU fallback.
- **Superseded:** the earlier `nvidia-smi` exit-code approach (kept in git history).
- **Override:** `WRITER_GPU_LAYERS=0` means "do not enforce GPU" (dev/CI without GPU).
  Any positive integer value means "use that many layers" and skips the nvidia-smi
  check (the caller asserts GPU is present). Default: `"99"`.
- **Alternatives considered:**
  - `llama-cli --list-devices` — more precise (confirms CUDA backend), but requires
    a full llama-cli invocation just for detection. Deferred; can be added later.
  - Parse `nvidia-smi` XML output — overkill for a presence check.

### D2: `-ngl 99` as the default GPU layer count

- **Choice:** Pass `-ngl 99` to llama-cli. llama.cpp clips to actual layer count.
- **Rationale:** Full offload of Gemma 4 E4B Q8_0 fits comfortably in 12+ GB VRAM.
  Partial offload (any value < total layers) would leave some computation on CPU,
  violating the NVIDIA-only constraint.
- **Alternatives considered:** `-ngl <exact layer count>` — brittle against model
  updates. `-ngl 0` or omitting the flag — causes CPU inference, the root bug.

### D3: Detection failure = adapter unavailable (no CPU fallback)

- **Choice:** If `nvidia-smi` exits non-zero and `WRITER_GPU_LAYERS` is not set,
  `detect()` returns `available: false` with `gpu_not_available` diagnostic.
- **Rationale:** Silent CPU fallback would violate the stated constraint and produce
  the same slow/empty behavior the user is trying to escape.
- **Alternatives considered:** Warn but allow CPU fallback — rejected because the
  user explicitly requires NVIDIA-only.

### D4: New `gpu_not_available` diagnostic code

- **Choice:** Add `"gpu_not_available"` to `ConnectionDiagnosticCode` in contracts.
- **Rationale:** The existing diagnostic codes (`not_installed`, `auth_required`, etc.)
  don't have a GPU-specific semantic. A dedicated code lets the UI surface a targeted
  recovery message.
- **Alternatives considered:** Reuse `not_installed` with a custom message — works
  but loses semantic precision for future UI handling.

## Risks / Trade-offs

[Risk] `nvidia-smi` may not be on PATH even when GPU + drivers are installed.
→ Mitigation: surface a specific diagnostic message pointing to NVIDIA driver install
  rather than "model not installed". Document that `WRITER_GPU_LAYERS=99` can override.

[Risk] A CUDA build of llama-cli may not be the bundled binary.
→ Mitigation: document that the bundled llama-cli MUST be the CUDA build for Windows.
  If `-ngl 99` is passed to a CPU-only build, llama.cpp logs a warning and falls back
  to CPU silently — this is an operator error, not a user-facing state.

[Risk] `-ngl 99` on a model that exceeds VRAM causes llama.cpp to error/OOM.
→ Mitigation: V1 targets ≥12 GB VRAM hardware. If llama-cli exits non-zero due to OOM,
  the existing error event path already surfaces the stderr message to the user.

## Migration Plan

1. Add `gpu_not_available` to contracts — backward compatible (additive).
2. Update `local-gemma-adapter.ts` — detect() and run() changes are contained to
   the adapter. No contract schema changes affect stored data.
3. No store migration needed.
4. Rollback: revert the two adapter changes; remove the diagnostic code addition.
