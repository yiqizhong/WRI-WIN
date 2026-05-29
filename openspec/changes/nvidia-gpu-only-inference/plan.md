# Plan: NVIDIA GPU-Only Inference

> Manual plan (superpowers:writing-plans unavailable this session; user authorized direct creation).

**Goal:** Fix "Agent returned empty rewrite" by adding `-ngl 99` to llama-cli spawn
args and gate the adapter on NVIDIA GPU detection so CPU fallback is impossible.

---

## Task 1: Add gpu_not_available to contracts

**File:** `packages/contracts/src/connection-diagnostic.ts`

### Step 1.1 — Read the current type
Read the `ConnectionDiagnosticCode` union and confirm `"gpu_not_available"` is absent.

### Step 1.2 — Add the new code
Add `"gpu_not_available"` to the union.

### Step 1.3 — Verify
`npm run typecheck --workspace @writer/contracts` — must pass.

Commit: `contracts: add gpu_not_available diagnostic code`

---

## Task 2: GPU detection + spawn arg in local-gemma-adapter.ts

**File:** `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`

### Step 2.1 — Add `getGpuLayers()` helper
```ts
function getGpuLayers(): string {
  return process.env["WRITER_GPU_LAYERS"] ?? "99";
}
```
Returns the layer count string. A value of `"0"` disables GPU (dev/CI only).

### Step 2.2 — Add `detectNvidiaGpu()` helper
```ts
async function detectNvidiaGpu(): Promise<boolean> {
  const layers = getGpuLayers();
  // Env override bypasses hardware check (dev / CI without GPU).
  if (layers !== "0" && process.env["WRITER_GPU_LAYERS"]) return true;
  return new Promise((resolve) => {
    const child = spawn("nvidia-smi", [], {
      stdio: ["ignore", "ignore", "ignore"],
      shell: false,
      windowsHide: true
    });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}
```

### Step 2.3 — Update `detect()`: add GPU check after binary + model checks
After the `binaryPath` check passes, add:
```ts
const layers = getGpuLayers();
if (layers !== "0") {
  const gpuOk = await detectNvidiaGpu();
  if (!gpuOk) {
    return buildAdapter({
      available: false,
      setupMessage:
        "NVIDIA GPU not detected. Install NVIDIA drivers or set WRITER_GPU_LAYERS=0 to disable this check.",
      diagnosticCode: "gpu_not_available"
    });
  }
}
```

### Step 2.4 — Update `run()`: add `-ngl` to spawn args
Replace the spawn args array in `run()`:
```ts
const child = spawn(binary, [
  "--model", modelPath,
  "--ctx-size", "8192",
  "--ngl", getGpuLayers(),      // ← ADD THIS LINE
  "--prompt", request.prompt,
  "--no-display-prompt",
  "--single-turn",
  "--simple-io",
  "--log-disable"
], { ... });
```
Note: llama-cli accepts both `--ngl` and `-ngl`; use `--ngl` for clarity.

### Step 2.5 — Verify
`npm run typecheck --workspace @writer/agent-adapters`

Commit: `agent-adapters: add NVIDIA GPU detection and -ngl offload to local-gemma adapter`

---

## Task 3: Tests

**File:** `packages/agent-adapters/src/adapters/` (add or update test file)

### Step 3.1 — Test: GPU absent → adapter unavailable
Mock `spawn("nvidia-smi")` to exit code 1.
Assert `detect()` returns `available: false` and `diagnostic.code === "gpu_not_available"`.

### Step 3.2 — Test: GPU present → adapter available (given binary + model ready)
Mock `spawn("nvidia-smi")` to exit code 0, mock binary + model present.
Assert `detect()` returns `available: true`.

### Step 3.3 — Test: WRITER_GPU_LAYERS override bypasses nvidia-smi
Set `process.env.WRITER_GPU_LAYERS = "32"`, don't mock nvidia-smi.
Assert `detect()` does NOT call nvidia-smi.

### Step 3.4 — Test: spawn args include --ngl
Mock everything needed for `run()` to reach the spawn call.
Assert the args array includes `"--ngl"` and `"99"` (or the env var value).

### Step 3.5 — Verify
`npm run test --workspace @writer/agent-adapters`

Commit: `agent-adapters: tests for GPU detection and -ngl arg`

---

## Task 4: Final verification

- `npm run typecheck`
- `npm run test`
