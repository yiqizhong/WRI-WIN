## 1. Q4_K_M manifest constant (WRI-213)

- [x] 1.1 Add `GEMMA_4_E4B_Q4KM_MANIFEST` constant to `apps/daemon/src/local-model-manifest.ts` with confirmed fileName, downloadUrl, expectedSha256, and fileSizeBytes
- [x] 1.2 Write unit test asserting Q4_K_M manifest fields match confirmed values and both manifests share `modelId`/`displayName`

## 2. NVIDIA VRAM detection (WRI-214)

- [x] 2.1 Write unit tests for the VRAM line parser: extracts total MiB from `CUDA0: … (12288 MiB, 12000 MiB free)`, returns `null` for CPU-only output and malformed lines
- [x] 2.2 Extend `listGpuDevices` in `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` to capture total MiB from the `CUDA0` line
- [x] 2.3 Export `detectNvidiaVram(): Promise<number | null>` with daemon-session caching; preserve existing `listGpuDevices` string-list return

## 3. Selection rule + manifest resolver (WRI-215)

- [x] 3.1 Write unit tests for `resolveLocalModelManifest`: boundary cases `null → blocked`, `11999 → Q4KM`, `12000 → Q8_0`, `12288 → Q8_0`, `8192 → Q4KM`
- [x] 3.2 Implement `VRAM_Q8_MIN_MIB = 12000` constant and `resolveLocalModelManifest(vram: number | null)` pure function in `apps/daemon/src/local-model-manifest.ts`

## 4. Wire resolver into daemon model layer (WRI-216)

- [x] 4.1 Route `getLocalModelStatus` through `resolveLocalModelManifest(await detectNvidiaVram())`; add blocked variant to return type
- [x] 4.2 Route `startModelDownload` through the resolver; refuse with clear error message when blocked
- [x] 4.3 Route `getModelFilePath` through the resolver's resolved manifest `fileName`

## 5. UI: selected quant size + blocked state (WRI-217)

- [x] 5.1 Update `apps/desktop/src/agents-panel.tsx` to render the model file size from the status response (not a hardcoded value)
- [x] 5.2 Add blocked-state render: when status includes blocked indicator, replace Download button with "No compatible NVIDIA GPU detected" message

## 6. Verification

- [x] 6.1 `npm run typecheck` passes with zero errors
- [x] 6.2 `npm run test` passes (unit tests from §1–§3 green)
- [x] 6.3 `npx openspec validate vram-based-quant-selection --type change --strict` passes
