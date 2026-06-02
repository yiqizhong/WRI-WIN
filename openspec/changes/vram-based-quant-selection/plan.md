# VRAM-Based Quant Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-select the right Gemma 4 E4B quant (`Q8_0` or `Q4_K_M`) based on the user's NVIDIA GPU VRAM so no machine downloads a model it cannot run.

**Architecture:** A pure resolver function in `local-model-manifest.ts` maps detected VRAM to a manifest or a blocked outcome. `detectNvidiaVram()` in `local-gemma-adapter.ts` extends the existing `--list-devices` probe with a module-level session cache. The daemon model layer (`local-models.ts`) routes `getLocalModelStatus`, `startModelDownload`, and `getModelFilePath` through the resolver. The UI reads `blockedReason` from the status response to conditionally replace the Download button with a message.

**Tech Stack:** TypeScript (ESM), Vitest, Zod 4. No new dependencies.

---

## File Map

- **Modify:** `packages/contracts/src/local-model.ts` — add `blockedReason: z.string().nullable()` to `localModelStatusResponseSchema`
- **Modify:** `apps/daemon/src/local-model-manifest.ts` — add `GEMMA_4_E4B_Q4KM_MANIFEST`, `VRAM_Q8_MIN_MIB`, `resolveLocalModelManifest()`
- **Modify:** `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` — add module-level VRAM cache, export `detectNvidiaVram()`
- **Modify:** `apps/daemon/src/local-models.ts` — make `getLocalModelStatus` async, route functions through resolver, update `getModelFilePath` signature
- **Modify:** `apps/daemon/src/routes/platform.ts` — `await getLocalModelStatus(state)` (2 call sites)
- **Modify:** `apps/desktop/src/agents-panel.tsx` — track `localModelBlockedReason`, show blocked message
- **Test:** `apps/daemon/src/local-model-manifest.test.ts` — Q4_K_M manifest fields + resolver boundary cases
- **Test:** `packages/agent-adapters/src/adapters/local-gemma-adapter.test.ts` — VRAM line parser + cache behavior
- **Test:** `apps/daemon/src/local-models.test.ts` — update `getLocalModelStatus` call sites to `await`

---

## Task 1: Q4_K_M manifest constant (WRI-213)

**Files:**
- Modify: `apps/daemon/src/local-model-manifest.ts`
- Test: `apps/daemon/src/local-model-manifest.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `apps/daemon/src/local-model-manifest.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { GEMMA_4_E4B_MANIFEST, GEMMA_4_E4B_Q4KM_MANIFEST } from "./local-model-manifest";

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

describe("GEMMA_4_E4B_Q4KM_MANIFEST", () => {
  it("has confirmed fileName", () => {
    expect(GEMMA_4_E4B_Q4KM_MANIFEST.fileName).toBe("gemma-4-E4B-it-Q4_K_M.gguf");
  });

  it("has confirmed fileSizeBytes", () => {
    expect(GEMMA_4_E4B_Q4KM_MANIFEST.fileSizeBytes).toBe(5335289824);
  });

  it("has confirmed expectedSha256", () => {
    expect(GEMMA_4_E4B_Q4KM_MANIFEST.expectedSha256).toBe(
      "90ce98129eb3e8cc57e62433d500c97c624b1e3af1fcc85dd3b55ad7e0313e9f"
    );
  });

  it("shares modelId and displayName with Q8_0", () => {
    expect(GEMMA_4_E4B_Q4KM_MANIFEST.modelId).toBe(GEMMA_4_E4B_MANIFEST.modelId);
    expect(GEMMA_4_E4B_Q4KM_MANIFEST.displayName).toBe(GEMMA_4_E4B_MANIFEST.displayName);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
cd apps/daemon && npx vitest run src/local-model-manifest.test.ts
```

Expected: FAIL — `GEMMA_4_E4B_Q4KM_MANIFEST` not exported.

- [ ] **Step 3: Add Q4_K_M manifest constant**

Replace `apps/daemon/src/local-model-manifest.ts` with:

```typescript
import type { LocalModelManifest } from "@writer/contracts";

// Pinned artifact: ggml-org/gemma-4-E4B-it-GGUF, file gemma-4-E4B-it-Q8_0.gguf
// sha256 sourced from Git LFS pointer (oid sha256) on 2026-05-28.
// This repo is ungated — download requires no HF auth token.
// If the repo becomes gated, use WRITER_HF_TOKEN env var (WRI-157 secret storage).
export const GEMMA_4_E4B_MANIFEST: LocalModelManifest = {
  modelId: "gemma-4-e4b",
  displayName: "Gemma 4 E4B",
  sourceRepo: "ggml-org/gemma-4-E4B-it-GGUF",
  fileName: "gemma-4-E4B-it-Q8_0.gguf",
  downloadUrl:
    "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q8_0.gguf",
  expectedSha256: "fb8f0c032de00b18c710824af3c7e5777c71e5fb60b13f13575f0a9e92ddecd0",
  gated: false,
  modelMaxContext: 131072,
  defaultContext: 16384,
  fileSizeBytes: 8_600_000_000
};

// Pinned artifact: ggml-org/gemma-4-E4B-it-GGUF, file gemma-4-E4B-it-Q4_K_M.gguf
// sha256 and size sourced from Git LFS pointer on 2026-06-02.
export const GEMMA_4_E4B_Q4KM_MANIFEST: LocalModelManifest = {
  modelId: "gemma-4-e4b",
  displayName: "Gemma 4 E4B",
  sourceRepo: "ggml-org/gemma-4-E4B-it-GGUF",
  fileName: "gemma-4-E4B-it-Q4_K_M.gguf",
  downloadUrl:
    "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf",
  expectedSha256: "90ce98129eb3e8cc57e62433d500c97c624b1e3af1fcc85dd3b55ad7e0313e9f",
  gated: false,
  modelMaxContext: 131072,
  defaultContext: 16384,
  fileSizeBytes: 5_335_289_824
};

export const ALL_LOCAL_MODEL_MANIFESTS: LocalModelManifest[] = [
  GEMMA_4_E4B_MANIFEST,
  GEMMA_4_E4B_Q4KM_MANIFEST
];
```

- [ ] **Step 4: Run tests — verify they pass**

```
cd apps/daemon && npx vitest run src/local-model-manifest.test.ts
```

Expected: PASS (Q4_K_M tests) + existing tests still pass.

---

## Task 2: NVIDIA VRAM detection (WRI-214)

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`
- Test: `packages/agent-adapters/src/adapters/local-gemma-adapter.test.ts`

- [ ] **Step 1: Write failing VRAM parser tests**

Add to `packages/agent-adapters/src/adapters/local-gemma-adapter.test.ts`:

```typescript
import { parseNvidiaVramMib } from "./local-gemma-adapter";

describe("parseNvidiaVramMib", () => {
  it("extracts total MiB from a CUDA0 line", () => {
    const lines = [
      "CUDA0: NVIDIA GeForce RTX 4070 (12288 MiB, 12000 MiB free)"
    ];
    expect(parseNvidiaVramMib(lines)).toBe(12288);
  });

  it("returns null for CPU-only output (no CUDA line)", () => {
    expect(parseNvidiaVramMib(["CPU: Intel Core i9"])).toBeNull();
  });

  it("returns null for an empty device list", () => {
    expect(parseNvidiaVramMib([])).toBeNull();
  });

  it("returns null when the CUDA0 line has no MiB values", () => {
    expect(parseNvidiaVramMib(["CUDA0: NVIDIA GPU (unknown)"])).toBeNull();
  });

  it("extracts total MiB (first number) not free MiB (second number)", () => {
    const lines = ["CUDA0: NVIDIA RTX 3070 (8192 MiB, 7500 MiB free)"];
    expect(parseNvidiaVramMib(lines)).toBe(8192);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
cd packages/agent-adapters && npx vitest run src/adapters/local-gemma-adapter.test.ts
```

Expected: FAIL — `parseNvidiaVramMib` not exported.

- [ ] **Step 3: Add VRAM parser and detectNvidiaVram to local-gemma-adapter.ts**

Add after the `listGpuDevices` function (line ~146):

```typescript
// Exported for unit-testing only — callers should use detectNvidiaVram().
export function parseNvidiaVramMib(deviceLines: string[]): number | null {
  for (const line of deviceLines) {
    if (!/^CUDA0:/i.test(line)) continue;
    const match = line.match(/\((\d+)\s*MiB/);
    if (match) return Number(match[1]);
  }
  return null;
}

let cachedNvidiaVram: number | null | undefined;

export async function detectNvidiaVram(): Promise<number | null> {
  if (cachedNvidiaVram !== undefined) return cachedNvidiaVram;
  const binaryPath = await getLlamaBinaryPath();
  if (!binaryPath) {
    cachedNvidiaVram = null;
    return null;
  }
  const devices = await listGpuDevices(binaryPath);
  cachedNvidiaVram = parseNvidiaVramMib(devices);
  return cachedNvidiaVram;
}
```

Also export `detectNvidiaVram` from `packages/agent-adapters/src/index.ts` (or wherever the package's public API is). Check `packages/agent-adapters/src/index.ts`:

```typescript
export { detectNvidiaVram } from "./adapters/local-gemma-adapter";
```

- [ ] **Step 4: Run tests — verify they pass**

```
cd packages/agent-adapters && npx vitest run src/adapters/local-gemma-adapter.test.ts
```

Expected: PASS.

---

## Task 3: Selection rule + resolver (WRI-215)

**Files:**
- Modify: `apps/daemon/src/local-model-manifest.ts`
- Test: `apps/daemon/src/local-model-manifest.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Add to `apps/daemon/src/local-model-manifest.test.ts`:

```typescript
import {
  GEMMA_4_E4B_MANIFEST,
  GEMMA_4_E4B_Q4KM_MANIFEST,
  resolveLocalModelManifest
} from "./local-model-manifest";

describe("resolveLocalModelManifest", () => {
  it("returns Q8_0 for VRAM >= 12000 (exact boundary)", () => {
    const result = resolveLocalModelManifest(12000);
    expect("manifest" in result && result.manifest).toBe(GEMMA_4_E4B_MANIFEST);
  });

  it("returns Q8_0 for VRAM = 12288 (real 12 GB card)", () => {
    const result = resolveLocalModelManifest(12288);
    expect("manifest" in result && result.manifest).toBe(GEMMA_4_E4B_MANIFEST);
  });

  it("returns Q4_K_M for VRAM = 11999 (just below threshold)", () => {
    const result = resolveLocalModelManifest(11999);
    expect("manifest" in result && result.manifest).toBe(GEMMA_4_E4B_Q4KM_MANIFEST);
  });

  it("returns Q4_K_M for VRAM = 8192 (8 GB GPU)", () => {
    const result = resolveLocalModelManifest(8192);
    expect("manifest" in result && result.manifest).toBe(GEMMA_4_E4B_Q4KM_MANIFEST);
  });

  it("returns blocked for null VRAM", () => {
    const result = resolveLocalModelManifest(null);
    expect("blocked" in result && result.blocked).toBe(true);
    expect("reason" in result && result.reason).toMatch(/No compatible NVIDIA GPU/i);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```
cd apps/daemon && npx vitest run src/local-model-manifest.test.ts
```

Expected: FAIL — `resolveLocalModelManifest` not exported.

- [ ] **Step 3: Add resolver to local-model-manifest.ts**

Append to `apps/daemon/src/local-model-manifest.ts`:

```typescript
import type { LocalModelManifest } from "@writer/contracts";

export type ManifestResolution =
  | { manifest: LocalModelManifest }
  | { blocked: true; reason: string };

// Real 12 GB cards report slightly under 12288 MiB — use 12000 so they get Q8_0.
export const VRAM_Q8_MIN_MIB = 12000;

export function resolveLocalModelManifest(vram: number | null): ManifestResolution {
  if (vram === null) {
    return { blocked: true, reason: "No compatible NVIDIA GPU detected" };
  }
  return { manifest: vram >= VRAM_Q8_MIN_MIB ? GEMMA_4_E4B_MANIFEST : GEMMA_4_E4B_Q4KM_MANIFEST };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```
cd apps/daemon && npx vitest run src/local-model-manifest.test.ts
```

Expected: all tests PASS.

---

## Task 4: Wire resolver into daemon model layer + blocked state (WRI-216)

**Files:**
- Modify: `packages/contracts/src/local-model.ts`
- Modify: `apps/daemon/src/local-models.ts`
- Modify: `apps/daemon/src/routes/platform.ts`
- Test: `apps/daemon/src/local-models.test.ts`

### Step 4a: Extend LocalModelStatusResponse contract

- [ ] **Step 1: Add blockedReason to the schema**

In `packages/contracts/src/local-model.ts`, change `localModelStatusResponseSchema`:

```typescript
export const localModelStatusResponseSchema = z.object({
  manifest: localModelManifestSchema,
  state: localModelStateSchema,
  blockedReason: z.string().nullable().optional()
});
```

- [ ] **Step 2: Verify typecheck passes**

```
npm run typecheck
```

Expected: no new errors from the schema change (the field is optional, so existing code that doesn't pass it is fine).

### Step 4b: Update local-models.ts

- [ ] **Step 3: Make getLocalModelStatus async and route through resolver**

In `apps/daemon/src/local-models.ts`:

1. Add imports at the top:
```typescript
import { detectNvidiaVram } from "@writer/agent-adapters";
import { resolveLocalModelManifest } from "./local-model-manifest";
```

2. Replace `getLocalModelStatus`:
```typescript
export async function getLocalModelStatus(state: DaemonState): Promise<LocalModelStatusResponse> {
  const stored = state.store.getLocalModel();
  const vram = await detectNvidiaVram();
  const resolution = resolveLocalModelManifest(vram);
  if ("blocked" in resolution) {
    return {
      manifest: GEMMA_4_E4B_MANIFEST,
      state: stored ?? buildState(),
      blockedReason: resolution.reason
    };
  }
  return {
    manifest: resolution.manifest,
    state: stored ?? buildState(),
    blockedReason: null
  };
}
```

3. Update `getModelFilePath` to accept a manifest parameter:
```typescript
export function getModelFilePath(state: DaemonState, manifest: LocalModelManifest): string {
  return join(getModelsDir(state), manifest.fileName);
}
```

4. Update `startModelDownload` to resolve manifest:
```typescript
export async function startModelDownload(state: DaemonState): Promise<{ started: boolean }> {
  const current = state.store.getLocalModel();

  if (current?.status === "downloading" || current?.status === "verifying") {
    return { started: false };
  }

  if (current?.status === "installed" || current?.status === "ready") {
    return { started: false };
  }

  const vram = await detectNvidiaVram();
  const resolution = resolveLocalModelManifest(vram);
  if ("blocked" in resolution) {
    throw new Error(resolution.reason);
  }
  const manifest = resolution.manifest;

  const resumeFrom = current?.downloadedBytes ?? 0;
  state.store.setLocalModel(
    buildState({
      status: "downloading",
      downloadedBytes: resumeFrom,
      totalBytes: current?.totalBytes || manifest.fileSizeBytes
    })
  );
  await state.store.save();

  void runDownload(state, resumeFrom, manifest).catch(async (error) => {
    const message = error instanceof Error ? error.message : "Download failed";
    const partial = state.store.getLocalModel();
    state.store.setLocalModel(
      buildState({ status: "failed", downloadedBytes: partial?.downloadedBytes ?? 0, totalBytes: partial?.totalBytes ?? 0, errorMessage: message })
    );
    await state.store.save();
  });

  return { started: true };
}
```

5. Update `runDownload` signature and body to use manifest parameter:
```typescript
async function runDownload(state: DaemonState, resumeFrom: number, manifest: LocalModelManifest): Promise<void> {
  const modelsDir = getModelsDir(state);
  const finalPath = getModelFilePath(state, manifest);
  const tempPath = `${finalPath}.tmp`;
  // ... rest of function unchanged, but replace all GEMMA_4_E4B_MANIFEST references with manifest:
  // - GEMMA_4_E4B_MANIFEST.downloadUrl  →  manifest.downloadUrl
  // - GEMMA_4_E4B_MANIFEST.fileSizeBytes →  manifest.fileSizeBytes
  // - GEMMA_4_E4B_MANIFEST.expectedSha256 → manifest.expectedSha256
```

6. Update `resetModelDownload` to use stored `modelPath` instead of `getModelFilePath`:
```typescript
export async function resetModelDownload(state: DaemonState): Promise<void> {
  activeDownload?.abort();
  activeDownload = null;

  const modelsDir = getModelsDir(state);
  const stored = state.store.getLocalModel();
  // Use stored path; fall back to both known quant filenames if state is missing.
  const pathsToRemove: string[] = stored?.modelPath
    ? [stored.modelPath, `${stored.modelPath}.tmp`]
    : [
        join(modelsDir, GEMMA_4_E4B_MANIFEST.fileName),
        join(modelsDir, GEMMA_4_E4B_Q4KM_MANIFEST.fileName),
        join(modelsDir, `${GEMMA_4_E4B_MANIFEST.fileName}.tmp`),
        join(modelsDir, `${GEMMA_4_E4B_Q4KM_MANIFEST.fileName}.tmp`)
      ];

  await mkdir(modelsDir, { recursive: true });
  await Promise.all(pathsToRemove.map((p) => rm(p, { force: true })));

  state.store.setLocalModel(buildState());
  await state.store.save();
}
```

- [ ] **Step 4: Update existing test file to await getLocalModelStatus**

In `apps/daemon/src/local-models.test.ts`, all calls to `getLocalModelStatus(state)` must become `await getLocalModelStatus(state)`. The test cases are:
- Line 43: `const status = getLocalModelStatus(state);` → `const status = await getLocalModelStatus(state);`
- Line 62: same
- Line 80: same
- Line 132: same
- Line 150: same

Also add at the top of the test file (if not present):
```typescript
import { vi, beforeEach, afterEach } from "vitest";
```

Mock `detectNvidiaVram` at the top of the describe block so tests don't spawn a real process:
```typescript
import * as agentAdapters from "@writer/agent-adapters";

// Before each test, simulate a 12 GB GPU so resolver returns Q8_0.
beforeEach(() => {
  vi.spyOn(agentAdapters, "detectNvidiaVram").mockResolvedValue(12288);
});
afterEach(() => {
  vi.restoreAllMocks();
});
```

Add a new test for the blocked state:
```typescript
it("getLocalModelStatus returns blockedReason when no NVIDIA GPU detected", async () => {
  vi.spyOn(agentAdapters, "detectNvidiaVram").mockResolvedValue(null);
  const status = await getLocalModelStatus(state);
  expect(status.blockedReason).toMatch(/No compatible NVIDIA GPU/i);
});
```

Add a new test for Q4_K_M selection:
```typescript
it("getLocalModelStatus returns Q4_K_M manifest for 8 GB GPU", async () => {
  vi.spyOn(agentAdapters, "detectNvidiaVram").mockResolvedValue(8192);
  const status = await getLocalModelStatus(state);
  expect(status.manifest.fileName).toBe("gemma-4-E4B-it-Q4_K_M.gguf");
  expect(status.blockedReason).toBeNull();
});
```

- [ ] **Step 5: Update routes/platform.ts to await getLocalModelStatus**

In `apps/daemon/src/routes/platform.ts`, two call sites need `await`:

Line 389:
```typescript
sendJson(response, 200, await getLocalModelStatus(state));
```

Line 406:
```typescript
sendJson(response, 200, await getLocalModelStatus(state));
```

- [ ] **Step 6: Run daemon tests**

```
cd apps/daemon && npx vitest run src/local-models.test.ts src/local-model-manifest.test.ts
```

Expected: all PASS.

- [ ] **Step 7: Run typecheck**

```
npm run typecheck
```

Expected: no errors.

---

## Task 5: UI — selected quant size + blocked state (WRI-217)

**Files:**
- Modify: `apps/desktop/src/agents-panel.tsx`

The UI already reads `s.manifest.fileSizeBytes` and stores it in `localModelSizeBytes` state (line 364). That will automatically reflect the correct quant size once the daemon returns the resolved manifest. We only need to add blocked-state handling.

- [ ] **Step 1: Add localModelBlockedReason state**

Find the existing state declarations near line 358-359 in `agents-panel.tsx`:
```typescript
const [localModelLoading, setLocalModelLoading] = useState<string | null>(null);
const [localModelSizeBytes, setLocalModelSizeBytes] = useState<number | null>(null);
```

Add:
```typescript
const [localModelBlockedReason, setLocalModelBlockedReason] = useState<string | null>(null);
```

- [ ] **Step 2: Populate localModelBlockedReason from status**

Find the `useEffect` that calls `getLocalModelStatus` (around line 361-366):
```typescript
useEffect(() => {
  if (!connected) return;
  void client.getLocalModelStatus()
    .then((s) => setLocalModelSizeBytes(s.manifest.fileSizeBytes))
    .catch(() => undefined);
}, [connected, client]);
```

Replace with:
```typescript
useEffect(() => {
  if (!connected) return;
  void client.getLocalModelStatus()
    .then((s) => {
      setLocalModelSizeBytes(s.manifest.fileSizeBytes);
      setLocalModelBlockedReason(s.blockedReason ?? null);
    })
    .catch(() => undefined);
}, [connected, client]);
```

- [ ] **Step 3: Show blocked message in place of Download button**

Find the Download / Reset button in the Local LLM section (around line 835-843). The current code pattern is:

```tsx
if (code === "not_installed" || !code) {
  void downloadLocalModel(adapter.id);
} else {
  void resetLocalModel(adapter.id);
}
```

The button is rendered conditionally based on the diagnostic code. Find the button render block for the local-gemma adapter. It currently looks approximately like:

```tsx
<WriterPrimaryButton
  className={hugWidth}
  onClick={() => { ... }}
>
  {code === "not_installed" || !code ? "Download" : "Reset"}
</WriterPrimaryButton>
```

Wrap it with a blocked-state check. Find the button and replace with:

```tsx
{localModelBlockedReason && adapter.id === "local-gemma" ? (
  <span className="text-xs text-[#e5f1ff]/50">{localModelBlockedReason}</span>
) : (
  <WriterPrimaryButton
    className={hugWidth}
    onClick={() => {
      e.stopPropagation();
      const code = adapter.diagnostic?.code;
      if (code === "not_installed" || !code) {
        void downloadLocalModel(adapter.id);
      } else {
        void resetLocalModel(adapter.id);
      }
    }}
  >
    {adapter.diagnostic?.code === "not_installed" || !adapter.diagnostic?.code ? "Download" : "Reset"}
  </WriterPrimaryButton>
)}
```

Note: Read the actual button block in agents-panel.tsx carefully before editing — the exact JSX structure may differ slightly from above. The pattern to match is the button that calls `downloadLocalModel` or `resetLocalModel`, inside the local-gemma adapter card.

- [ ] **Step 4: Typecheck desktop**

```
npm run typecheck
```

Expected: no errors.

---

## Task 6: Verification (WRI-219 / §6 tasks)

- [ ] **Step 1: Run all tests**

```
npm run test
```

Expected: all tests PASS (green). Zero failures.

- [ ] **Step 2: Run typecheck**

```
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Run OpenSpec strict validation**

```
npx openspec validate vram-based-quant-selection --type change --strict
```

Expected: validation passes.
