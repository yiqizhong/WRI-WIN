Manual brainstorm capture for `nvidia-gpu-only-inference`

Note: `superpowers:brainstorming` was not available in this session. The user authorized
manual brainstorm creation after the PRECHECK was reported.

## Background

The local Gemma adapter (`packages/agent-adapters/src/adapters/local-gemma-adapter.ts`)
spawns `llama-cli` with no GPU offload flags. On Windows, llama.cpp defaults to CPU-only
inference when `-ngl` (number of GPU layers) is absent.

Consequence: the model either produces nothing or takes so long the response appears empty,
causing `paste-text.ts` to throw `"Agent returned empty rewrite"`.

The user's requirement is stricter than just "add GPU support": inference MUST run
exclusively on the NVIDIA GPU. No CPU fallback, no AMD/Intel GPU. If an NVIDIA GPU is
not reachable, the adapter must fail fast with a clear error — it must NOT silently
downgrade to CPU.

## Root Cause Chain

1. `spawn(binary, [...no -ngl flag...])` → llama-cli infers on CPU.
2. CPU inference on an 8.6 GB Q8_0 model is extremely slow on most hardware, often timing
   out or producing a near-empty stream.
3. `extractSuggestedTextFromAgentEvents` returns an empty string.
4. `paste-text.ts` throws `"Agent returned empty rewrite"`.

## Design Questions

### Q1: How do we detect NVIDIA GPU availability?

**Options considered:**

A. Shell out to `nvidia-smi` — available on any Windows machine with NVIDIA drivers.
   Returns exit 0 if GPU is present; non-zero if absent or driver issue.
   Fast, no extra dependencies, already a standard diagnostic tool.

B. Check llama-cli response to `--list-devices` — available in llama.cpp builds
   with CUDA backend. More precise (confirms CUDA backend compiled in), but
   requires a llama-cli invocation just for detection.

C. Environment variable override `WRITER_GPU_LAYERS` — lets CI/dev override
   without NVIDIA hardware.

**Decision:** Use `nvidia-smi` as the primary check (fast, no llama-cli overhead).
Fall back to `llama-cli --list-devices` if `nvidia-smi` is absent (edge case where
CUDA is present but nvidia-smi is not on PATH). Honor `WRITER_GPU_LAYERS` override
for dev/CI environments.

### Q2: What -ngl value to use?

llama.cpp's `-ngl N` offloads N transformer layers to GPU. Setting it to a large
value (e.g. 99 or 9999) means "offload as many layers as VRAM allows"; llama.cpp
clips it to the actual layer count. For Gemma 4 E4B Q8_0, full offload fits in
8–12 GB VRAM (the target hardware has RTX cards with ≥12 GB).

**Decision:** Default to `-ngl 99` (full offload). Do NOT add a partial-offload
fallback — partial offload still uses CPU for un-offloaded layers, violating the
NVIDIA-only constraint.

### Q3: How to enforce NVIDIA-only strictly?

Two enforcement points:
1. `detect()` — return `available: false` with a clear diagnostic if NVIDIA GPU
   is not confirmed.
2. `run()` — re-check before spawning; if GPU check fails, return a `failedHandle`
   with a user-readable message.

Additionally: pass `--override-kv general.device=cuda` or rely on `-ngl 99` alone?
In practice, `-ngl 99` on a CUDA build of llama-cli already routes all computation
to CUDA. The explicit device override is belt-and-suspenders but not required for
CUDA-only llama.cpp builds.

**Decision:** `-ngl 99` is sufficient for CUDA-only enforcement given a CUDA build
of llama-cli. Document that the bundled llama-cli must be the CUDA build.

### Q4: How to surface GPU errors to the user?

The existing adapter diagnostic system already supports `setupMessage` and
`ConnectionDiagnosticCode`. We need a new diagnostic code for "gpu_not_available"
or reuse "not_installed".

**Decision:** Reuse the existing `diagnostic` field with a new descriptive message.
Add a `"gpu_not_available"` connection diagnostic code to contracts.

## Design Direction

1. Add `gpu_not_available` to `ConnectionDiagnosticCode` in contracts.
2. Add a `detectNvidiaGpu()` helper in the local-gemma adapter (or a shared
   `gpu-detect.ts` in agent-adapters) using `nvidia-smi`.
3. In `detect()`: after confirming binary + model are ready, call `detectNvidiaGpu()`.
   If it fails → return `available: false` with `gpu_not_available` diagnostic.
4. In `run()`: pass `-ngl 99` to llama-cli spawn args.
5. Honor `WRITER_GPU_LAYERS` env var override (defaults to `"99"`).
6. Update design.md and specs for this change.
7. No UI changes needed — existing diagnostic display already surfaces setup messages.
