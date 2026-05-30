# Speculative Decoding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in speculative decoding to the Local Gemma runtime using Google's dedicated Gemma 4 E4B draft model — improving decode tok/s from ~40 toward the 78 t/s Q8 bandwidth ceiling with zero quality loss.

**Architecture:** Manifest gains an optional `draftModel` sibling spec. A new daemon install action downloads/SHA-verifies the draft. Storage persists a `{ enabled, lastError? }` slice. A pure `resolveDraftModelPath(env, settings)` helper feeds the existing `buildSpawnArgs` so the runtime spawns `llama-cli` with `--model-draft <path>`. Cold-spawn fallback in `local-gemma-adapter.ts` mirrors the flag. On draft-load VRAM failure the runtime falls back once to non-speculative (mirrors the FP16→q8 KV pattern), persisting the error and emitting a `draftModelDisabled` event for a Settings banner.

**Tech Stack:** TypeScript (ESM), npm workspaces, Zod 4, Vitest 4. Workspaces: `@writer/contracts`, `@writer/storage`, `@writer/daemon`, `@writer/agent-adapters`, `@writer/desktop`.

> **DEPENDENCY:** This plan assumes `expand-local-context-window` and `tune-local-inference-speed` are landed (both archived). It extends `buildSpawnArgs`, `resolveCtxSize`, `resolveKvType`, `resolveFlashAttn`, `resolveUbatch`, `isVramLoadFailure`, and `parseTurnMetrics` already in `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`.

---

## File Structure

- `packages/contracts/src/local-model.ts` — add `draftModelSchema`, extend `localModelManifestSchema`.
- `packages/contracts/src/local-model.test.ts` — manifest validates with and without `draftModel`.
- `apps/daemon/src/local-model-manifest.ts` — populate `draftModel` on `GEMMA_4_E4B_MANIFEST`.
- `packages/storage/src/store.ts` — add `localGemma.speculativeDecoding` slice + getters/setters + migration.
- `packages/storage/src/store.test.ts` — migration test (empty + present + partial).
- `apps/daemon/src/local-models.ts` — add `installDraftModel`, `setSpeculativeDecodingEnabled`, helpers.
- `apps/daemon/src/local-models.test.ts` — install action: success, idempotent, SHA mismatch.
- `apps/daemon/src/server.ts` (routes) — `POST /local-model/draft/install`, `PUT /local-model/draft/enabled`.
- `packages/agent-adapters/src/adapters/local-gemma-runtime.ts` — add `resolveDraftModelPath`, extend `buildSpawnArgs`, draft-load fallback in `ensureProcess`, extend `parseTurnMetrics`.
- `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts` — resolver, builder, fallback detector, perf-log extension.
- `packages/agent-adapters/src/adapters/local-gemma-adapter.ts` — cold-spawn `--model-draft`.
- `apps/desktop/src/settings/SpeedBoostSection.tsx` (new) — Install button, toggle, banner.
- `apps/desktop/src/settings/SpeedBoostSection.test.tsx` — pure rendering by state.

---

## Task 1: Contracts — draftModel field

**Files:**
- Modify: `packages/contracts/src/local-model.ts`
- Test: `packages/contracts/src/local-model.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `local-model.test.ts`:

```typescript
describe("draftModel field", () => {
  it("accepts a manifest without draftModel", () => {
    const r = localModelManifestSchema.safeParse(VALID_MANIFEST);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.draftModel).toBeUndefined();
  });
  it("accepts a valid draftModel", () => {
    const r = localModelManifestSchema.safeParse({
      ...VALID_MANIFEST,
      draftModel: {
        url: "https://example.com/draft.gguf",
        sha256: "a".repeat(64),
        sizeBytes: 500_000_000,
        fileName: "draft.gguf"
      }
    });
    expect(r.success).toBe(true);
  });
  it("rejects a draftModel with short sha256", () => {
    const r = localModelManifestSchema.safeParse({
      ...VALID_MANIFEST,
      draftModel: { url: "https://x", sha256: "short", sizeBytes: 1, fileName: "f" }
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/contracts run test -- local-model`
Expected: FAIL — `draftModel` not in schema.

- [ ] **Step 3: Implement**

In `packages/contracts/src/local-model.ts`, before `localModelManifestSchema`:

```typescript
export const draftModelSchema = z.object({
  url: z.string().url(),
  sha256: z.string().length(64),
  sizeBytes: z.number().int().positive(),
  fileName: z.string().min(1)
});

export type DraftModelManifest = z.infer<typeof draftModelSchema>;
```

Extend `localModelManifestSchema`:

```typescript
export const localModelManifestSchema = z.object({
  modelId: z.string().min(1),
  displayName: z.string().min(1),
  sourceRepo: z.string().min(1),
  fileName: z.string().min(1),
  downloadUrl: z.string().url(),
  expectedSha256: z.string().length(64),
  gated: z.boolean(),
  modelMaxContext: z.number().int().positive(),
  defaultContext: z.number().int().positive(),
  fileSizeBytes: z.number().int().positive(),
  draftModel: draftModelSchema.optional()
});
```

Export the type re-export in `packages/contracts/src/index.ts`:

```typescript
export {
  // ...existing...
  draftModelSchema
} from "./local-model";
export type { DraftModelManifest } from "./local-model";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/contracts run test -- local-model && npm --workspace @writer/contracts run typecheck`
Expected: PASS.

- [ ] **Step 5: Populate manifest**

In `apps/daemon/src/local-model-manifest.ts` update `GEMMA_4_E4B_MANIFEST`:

```typescript
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
  fileSizeBytes: 8_600_000_000,
  // Pinned during apply: lookup the official Gemma 4 E4B draft on Hugging Face;
  // values below are placeholders — implementer MUST replace with the real
  // url/sha256/sizeBytes/fileName before opening the PR. If the official draft
  // is not yet published as a GGUF, surface BLOCKED to the controller.
  draftModel: {
    url: "https://huggingface.co/google/gemma-4-E4B-draft-GGUF/resolve/main/gemma-4-E4B-draft-Q4_0.gguf",
    sha256: "REPLACE_BEFORE_MERGE_REPLACE_BEFORE_MERGE_REPLACE_BEFORE_MERGE___",
    sizeBytes: 500_000_000,
    fileName: "gemma-4-E4B-draft-Q4_0.gguf"
  }
};
```

If the official draft GGUF cannot be found, report DONE_WITH_CONCERNS and leave `draftModel` omitted; the spec/tests still work via env override.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/local-model.ts packages/contracts/src/local-model.test.ts packages/contracts/src/index.ts apps/daemon/src/local-model-manifest.ts
git commit -m "feat(contracts): add optional draftModel field to local model manifest"
```

---

## Task 2: Storage slice + migration

**Files:**
- Modify: `packages/storage/src/store.ts`
- Test: `packages/storage/src/store.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `store.test.ts`:

```typescript
describe("speculativeDecoding slice", () => {
  it("defaults to { enabled: false } on a fresh store", async () => {
    const store = await loadStoreForTest();
    expect(store.getSpeculativeDecoding()).toEqual({ enabled: false });
  });
  it("persists enabled and lastError", async () => {
    const store = await loadStoreForTest();
    store.setSpeculativeDecoding({ enabled: true, lastError: "vram" });
    await store.save();
    const reload = await loadStoreForTest();
    expect(reload.getSpeculativeDecoding()).toEqual({ enabled: true, lastError: "vram" });
  });
  it("migrates a snapshot lacking the slice to the default", async () => {
    // Write a legacy snapshot without speculativeDecoding, then load.
    await writeLegacySnapshotForTest({ /* fields without speculativeDecoding */ });
    const store = await loadStoreForTest();
    expect(store.getSpeculativeDecoding()).toEqual({ enabled: false });
  });
});
```

(Reuse the existing test helpers in `store.test.ts` for `loadStoreForTest` / `writeLegacySnapshotForTest` — if those names differ, adapt to the actual helpers in the file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/storage run test -- store`
Expected: FAIL — `getSpeculativeDecoding is not a function`.

- [ ] **Step 3: Implement**

In `packages/storage/src/store.ts`:

```typescript
export type SpeculativeDecodingState = {
  enabled: boolean;
  lastError?: string;
};

// Add to the in-memory snapshot type:
//   speculativeDecoding?: SpeculativeDecodingState;
// (find the existing snapshot type and add this optional field)
```

Add the two methods on the store class:

```typescript
getSpeculativeDecoding(): SpeculativeDecodingState {
  return this.snapshot.speculativeDecoding ?? { enabled: false };
}

setSpeculativeDecoding(value: SpeculativeDecodingState): void {
  this.snapshot.speculativeDecoding = value;
}
```

In `migrateLoadedSnapshot` (the existing migration method), add at the end before `return migrated`:

```typescript
if (this.snapshot.speculativeDecoding === undefined) {
  this.snapshot.speculativeDecoding = { enabled: false };
  migrated = true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/storage run test -- store && npm --workspace @writer/storage run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storage/src/store.ts packages/storage/src/store.test.ts
git commit -m "feat(storage): add speculativeDecoding slice with migration"
```

---

## Task 3: Daemon install action

**Files:**
- Modify: `apps/daemon/src/local-models.ts`
- Test: `apps/daemon/src/local-models.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `local-models.test.ts`:

```typescript
describe("installDraftModel", () => {
  it("is a no-op when the manifest has no draftModel", async () => {
    const state = await makeStateForTest({ manifest: { ...MANIFEST, draftModel: undefined } });
    const result = await installDraftModel(state);
    expect(result.installed).toBe(false);
    expect(result.reason).toMatch(/no draft model/i);
  });
  it("rejects when the downloaded file's SHA mismatches", async () => {
    const state = await makeStateForTest({ manifest: { ...MANIFEST, draftModel: BAD_SHA_DRAFT } });
    await expect(installDraftModel(state)).rejects.toThrow(/sha/i);
    // Partial file is cleaned up.
    await expect(stat(getDraftFilePath(state)!)).rejects.toThrow();
  });
  it("is idempotent when the target file exists with the correct SHA", async () => {
    const state = await makeStateForTest({ manifest: { ...MANIFEST, draftModel: GOOD_DRAFT } });
    await placeFileWithSha(getDraftFilePath(state)!, GOOD_DRAFT.sha256);
    const result = await installDraftModel(state);
    expect(result.installed).toBe(true);
    expect(result.path).toBe(getDraftFilePath(state));
  });
});
```

Use the patterns already present in `local-models.test.ts` (mock fetch via undici interceptor + tmp dirs). If the file has none, add a minimal one matching the existing test utilities you find when reading the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/daemon run test -- local-models`
Expected: FAIL — `installDraftModel is not exported`.

- [ ] **Step 3: Implement**

In `apps/daemon/src/local-models.ts` add near `getModelFilePath`:

```typescript
export function getDraftFilePath(state: DaemonState): string | null {
  const draft = GEMMA_4_E4B_MANIFEST.draftModel;
  if (!draft) return null;
  return join(getModelsDir(state), draft.fileName);
}

export type DraftInstallResult =
  | { installed: false; reason: string }
  | { installed: true; path: string };

export async function installDraftModel(state: DaemonState): Promise<DraftInstallResult> {
  const draft = GEMMA_4_E4B_MANIFEST.draftModel;
  if (!draft) return { installed: false, reason: "No draft model declared for this model" };
  const target = getDraftFilePath(state)!;

  // Idempotent: target exists with correct SHA → done.
  try {
    await stat(target);
    const existingSha = await sha256OfFile(target);
    if (existingSha === draft.sha256) return { installed: true, path: target };
  } catch {
    // fall through to download
  }

  await mkdir(getModelsDir(state), { recursive: true });
  const partial = `${target}.partial`;
  try {
    await downloadToFile(draft.url, partial);
    const actual = await sha256OfFile(partial);
    if (actual !== draft.sha256) {
      await rm(partial, { force: true });
      throw new Error(`Draft model SHA mismatch: expected ${draft.sha256}, got ${actual}`);
    }
    await rename(partial, target);
  } catch (err) {
    await rm(partial, { force: true });
    throw err;
  }
  return { installed: true, path: target };
}

export async function setSpeculativeDecodingEnabled(state: DaemonState, enabled: boolean): Promise<void> {
  const current = state.store.getSpeculativeDecoding();
  state.store.setSpeculativeDecoding({ enabled, lastError: enabled ? current.lastError : undefined });
  await state.store.save();
}

// sha256OfFile and downloadToFile already exist in this file as private helpers
// for the main model — reuse them. If their names differ, use whatever the file
// exposes (e.g. computeFileSha256 / streamDownload).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/daemon run test -- local-models && npm --workspace @writer/daemon run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/local-models.ts apps/daemon/src/local-models.test.ts
git commit -m "feat(daemon): add installDraftModel action with SHA verification"
```

---

## Task 4: Daemon routes

**Files:**
- Modify: `apps/daemon/src/server.ts` (or wherever local-model routes live — check existing `POST /local-model/install` to find the file)
- Test: `apps/daemon/src/local-models.test.ts` (add route-level cases) OR `apps/daemon/src/integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add a route test alongside the existing local-model route tests:

```typescript
describe("local-model draft routes", () => {
  it("POST /local-model/draft/install triggers install", async () => {
    const { app, state } = await makeAppForTest({ draftModel: GOOD_DRAFT });
    const res = await request(app).post("/local-model/draft/install");
    expect(res.status).toBe(200);
    expect(res.body.installed).toBe(true);
  });
  it("PUT /local-model/draft/enabled persists the toggle", async () => {
    const { app, state } = await makeAppForTest({ draftModel: GOOD_DRAFT });
    await request(app).put("/local-model/draft/enabled").send({ enabled: true });
    expect(state.store.getSpeculativeDecoding().enabled).toBe(true);
    await request(app).put("/local-model/draft/enabled").send({ enabled: false });
    expect(state.store.getSpeculativeDecoding().enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/daemon run test`
Expected: FAIL — routes return 404.

- [ ] **Step 3: Implement**

In the routes file (locate by grepping `POST.*local-model` in `apps/daemon/src/server.ts` or routes module), add:

```typescript
app.post("/local-model/draft/install", async (_req, res) => {
  try {
    const result = await installDraftModel(state);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Install failed" });
  }
});

app.put("/local-model/draft/enabled", async (req, res) => {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "enabled must be boolean" });
    return;
  }
  await setSpeculativeDecodingEnabled(state, parsed.data.enabled);
  res.json({ ok: true, enabled: parsed.data.enabled });
});
```

Add a Zod schema export to contracts if the daemon-side validation uses shared schemas (follow existing conventions in this codebase).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/daemon run test && npm --workspace @writer/daemon run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/server.ts apps/daemon/src/local-models.test.ts
git commit -m "feat(daemon): expose draft install + toggle routes"
```

---

## Task 5: Runtime resolver + buildSpawnArgs extension

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`
- Test: `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `local-gemma-runtime.test.ts`:

```typescript
describe("resolveDraftModelPath", () => {
  it("returns env path when set, regardless of settings", () => {
    expect(resolveDraftModelPath("/env.gguf", { enabled: false, path: "/s.gguf" })).toBe("/env.gguf");
    expect(resolveDraftModelPath("/env.gguf", { enabled: true,  path: "/s.gguf" })).toBe("/env.gguf");
  });
  it("returns settings path when env unset, toggle on, path present", () => {
    expect(resolveDraftModelPath(undefined, { enabled: true, path: "/s.gguf" })).toBe("/s.gguf");
  });
  it("returns null when toggle off", () => {
    expect(resolveDraftModelPath(undefined, { enabled: false, path: "/s.gguf" })).toBeNull();
  });
  it("returns null when toggle on but path missing", () => {
    expect(resolveDraftModelPath(undefined, { enabled: true, path: null })).toBeNull();
  });
  it("returns null when both undefined", () => {
    expect(resolveDraftModelPath(undefined, { enabled: false, path: null })).toBeNull();
  });
});

describe("buildSpawnArgs draft model", () => {
  const base = {
    modelPath: "/m.gguf", ctxSize: 16384, gpuLayers: "99", kvType: "f16" as const,
    flashAttn: "on" as const, ubatch: 1024, system: ""
  };
  it("appends --model-draft when set", () => {
    const args = buildSpawnArgs({ ...base, draftModelPath: "/d.gguf" });
    expect(args[args.indexOf("--model-draft") + 1]).toBe("/d.gguf");
  });
  it("omits --model-draft when null", () => {
    const args = buildSpawnArgs({ ...base, draftModelPath: null });
    expect(args).not.toContain("--model-draft");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `local-gemma-runtime.ts`, after `resolveUbatch`:

```typescript
export type DraftSettings = { enabled: boolean; path: string | null };

/**
 * Precedence: explicit env > storage settings (enabled + path) > null.
 * Pure: no I/O, no file-exists check (the install flow already verified).
 */
export function resolveDraftModelPath(
  envValue: string | undefined,
  settings: DraftSettings
): string | null {
  if (envValue && envValue.length > 0) return envValue;
  if (settings.enabled && settings.path) return settings.path;
  return null;
}
```

Extend `buildSpawnArgs`:

```typescript
export function buildSpawnArgs(input: {
  modelPath: string;
  ctxSize: number;
  gpuLayers: string;
  kvType: KvCacheType;
  flashAttn: FlashAttn;
  ubatch: number;
  draftModelPath: string | null;
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
  if (input.draftModelPath) {
    args.push("--model-draft", input.draftModelPath);
  }
  if (input.system) {
    args.push("-sys", input.system);
  }
  return args;
}
```

Update the existing `buildSpawnArgs` tests' base fixture (search for `flashAttn: "on" as const,`) to also include `draftModelPath: null` so the prior tests still compile.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-runtime.ts packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts
git commit -m "feat(local-gemma): resolve draft model path and add --model-draft to spawn args"
```

---

## Task 6: Runtime — wire draft into spawnProcess + ensureProcess fallback

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`
- Test: `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
describe("isDraftLoadFailure", () => {
  it("matches a llama-cli draft VRAM error line", () => {
    const stderr = "ggml_cuda_init: failed to allocate VRAM for --model-draft (gemma-4-E4B-draft-Q4_0.gguf)\n";
    expect(isDraftLoadFailure(stderr)).toBe(true);
  });
  it("tolerates CRLF", () => {
    const stderr = "ggml_cuda: out of memory allocating draft model\r\n";
    expect(isDraftLoadFailure(stderr)).toBe(true);
  });
  it("returns false when only the main model failed", () => {
    expect(isDraftLoadFailure("out of memory loading main model")).toBe(false);
  });
  it("returns false on unrelated stderr", () => {
    expect(isDraftLoadFailure("model loaded successfully")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: FAIL.

- [ ] **Step 3: Implement detector**

In `local-gemma-runtime.ts`, after `isVramLoadFailure`:

```typescript
/**
 * Match a llama-cli stderr signature for a draft-model load failure.
 * Conservative — must mention BOTH a VRAM/allocation marker AND the draft model.
 */
export function isDraftLoadFailure(stderr: string): boolean {
  if (!/--model-draft|model-draft|draft model/i.test(stderr)) return false;
  return /out of memory|failed to allocate|cudamalloc|cuda error|vram/i.test(stderr);
}
```

- [ ] **Step 4: Wire draft into runtime construction**

Extend `LocalGemmaRuntimeOptions`:

```typescript
export type LocalGemmaRuntimeOptions = {
  binary: string;
  modelPath: string;
  gpuLayers: string;
  contextSize?: number;
  draftSettings?: DraftSettings;  // optional; defaults to disabled
};
```

Add private state to the class:

```typescript
private draftFallbackUsed = false;
private effectiveDraftPath(): string | null {
  if (this.draftFallbackUsed) return null;
  return resolveDraftModelPath(
    process.env["WRITER_LOCAL_DRAFT_MODEL"],
    this.opts.draftSettings ?? { enabled: false, path: null }
  );
}
private readonly draftPinned = process.env["WRITER_LOCAL_DRAFT_MODEL"] !== undefined;
```

Update `spawnProcess` to thread the resolved path:

```typescript
private spawnProcess(system: string, sessionId: string): void {
  const { binary, modelPath, gpuLayers, contextSize } = this.opts;
  const ctxSize = resolveCtxSize(process.env["WRITER_LOCAL_CTX_SIZE"], contextSize);
  const args = buildSpawnArgs({
    modelPath,
    ctxSize,
    gpuLayers,
    kvType: this.kvType,
    flashAttn: resolveFlashAttn(process.env["WRITER_LOCAL_FLASH_ATTN"]),
    ubatch: resolveUbatch(process.env["WRITER_LOCAL_UBATCH"]),
    draftModelPath: this.effectiveDraftPath(),
    system
  });
  // ... rest unchanged
}
```

Extend `ensureProcess` fallback chain. Add a draft-fallback **before** the existing kv-fallback (try draft fallback first because it's the lighter retreat):

```typescript
} catch (err) {
  if (
    !this.draftPinned &&
    !this.draftFallbackUsed &&
    this.effectiveDraftPath() !== null &&
    isDraftLoadFailure(this.stderrBuf)
  ) {
    this.draftFallbackUsed = true;
    if (this.resident) this.evict();
    this.spawnProcess(system, sessionId);
    await this.waitForReady(turnTimeoutMs());
    // Emit a stderr line so the daemon can surface a banner.
    console.error("[local-gemma] draft model disabled: load failed (insufficient VRAM)");
    return;
  }
  if (!this.kvPinned && !this.kvFallbackUsed && this.kvType === "f16" && isVramLoadFailure(this.stderrBuf)) {
    // ... existing kv-fallback unchanged
  }
  throw err;
}
```

- [ ] **Step 5: Add a fallback test**

Add to the test file (after the resolver/builder/detector tests). This test uses a mock spawn helper if one exists in the file; otherwise the test verifies the detector + state-transition only and the live fallback is covered by the manual verification step:

```typescript
describe("draft fallback", () => {
  it("draft fallback path", () => {
    // If a mock spawn helper already exists for the kv-fallback test, reuse it.
    // The shape of this test should mirror the kv-fallback test in this file.
    // Otherwise: assert via state — set draftFallbackUsed via a controlled
    // shim, call effectiveDraftPath(), and confirm null is returned.
    // (See the kv-fallback test pattern for the exact mocking convention.)
  });
});
```

If no mock-spawn pattern exists in the test file, leave this as DONE_WITH_CONCERNS and rely on the integration test in Task 9.

- [ ] **Step 6: Run test + typecheck**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime && npm --workspace @writer/agent-adapters run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-runtime.ts packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts
git commit -m "feat(local-gemma): one-shot fallback when draft model fails to load"
```

---

## Task 7: Cold-spawn fallback parity

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`

- [ ] **Step 1: Resolve and apply the flag in cold-spawn args**

In `local-gemma-adapter.ts`, find the existing `args` array in the cold-spawn `run(...)` path (around the `-fa`/`-ub` lines). Import `resolveDraftModelPath` from `./local-gemma-runtime`. Before the args array, resolve a draft path from env only (the cold-spawn path has no access to storage settings — that's deliberate; it's the fallback path):

```typescript
const draftPath = resolveDraftModelPath(
  process.env["WRITER_LOCAL_DRAFT_MODEL"],
  { enabled: false, path: null }  // settings unavailable on cold-spawn
);
```

Then append into the args array, after the KV cache flags and before `-n 512`:

```typescript
...(draftPath ? ["--model-draft", draftPath] : []),
```

- [ ] **Step 2: Typecheck + tests**

Run: `npm --workspace @writer/agent-adapters run typecheck && npm --workspace @writer/agent-adapters run test`
Expected: PASS (existing tests don't set `WRITER_LOCAL_DRAFT_MODEL`, so behavior is unchanged).

- [ ] **Step 3: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-adapter.ts
git commit -m "feat(local-gemma): apply --model-draft to cold-spawn path when env-overridden"
```

---

## Task 8: Thread DraftSettings from daemon to runtime

**Files:**
- Modify: wherever `LocalGemmaRuntime` is instantiated in `apps/daemon/src/` (grep for `new LocalGemmaRuntime` or `LocalGemmaRuntime(` to find the call site)
- Modify: the resident-process construction path so that `draftSettings` is read from the store and passed in.

- [ ] **Step 1: Locate**

Grep for `new LocalGemmaRuntime` in `apps/daemon/src` and in `packages/agent-adapters/src`. The runtime is built somewhere in the agent-run / `tryRunResident` flow. Read that file enough to understand the constructor call.

- [ ] **Step 2: Pass draftSettings at construction**

At the construction site, build the settings struct from storage:

```typescript
const dec = state.store.getSpeculativeDecoding();
const draftPath = dec.enabled ? getDraftFilePath(state) : null;
const runtime = new LocalGemmaRuntime({
  binary,
  modelPath,
  gpuLayers,
  contextSize,
  draftSettings: { enabled: dec.enabled, path: draftPath }
});
```

Since the runtime is constructed once per session/process and the toggle triggers eviction (Task 4 wires `setSpeculativeDecodingEnabled` to `state.store.save`), the new settings are read on the next construction — no in-place hot-update needed. **However** the runtime must be evicted when the toggle changes. Search for the existing eviction triggers (session change, system-prompt change). If there's a single `runtime.evict()` entry point, call it from `setSpeculativeDecodingEnabled` after the store write.

If `setSpeculativeDecodingEnabled` is in `local-models.ts` and the runtime is in a sibling file (e.g. `agents.ts` or `runtime-registry.ts`), import the eviction function and call it:

```typescript
export async function setSpeculativeDecodingEnabled(state: DaemonState, enabled: boolean): Promise<void> {
  const current = state.store.getSpeculativeDecoding();
  state.store.setSpeculativeDecoding({ enabled, lastError: enabled ? current.lastError : undefined });
  await state.store.save();
  shutdownLocalGemmaRuntime();  // existing function used on SIGINT
}
```

- [ ] **Step 3: Typecheck + tests**

Run: `npm run typecheck && npm --workspace @writer/daemon run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/daemon/src/agents.ts apps/daemon/src/local-models.ts  # adjust paths to actual files touched
git commit -m "feat(daemon): thread draft settings into LocalGemmaRuntime + evict on toggle"
```

---

## Task 9: parseTurnMetrics — draft acceptance (optional field)

**Files:**
- Modify: `packages/agent-adapters/src/adapters/local-gemma-runtime.ts`
- Test: `packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

Append to the existing `describe("parseTurnMetrics")`:

```typescript
it("extracts draft acceptance when present", () => {
  const footer = "[ Prompt: 200 t/s | eval: 60 t/s | draft: 3.2/4.0 accepted ]";
  expect(parseTurnMetrics(footer)).toEqual({
    promptTokensPerSec: 200,
    evalTokensPerSec: 60,
    draftAccepted: 3.2,
    draftProposed: 4.0
  });
});
it("draftAccepted is null when absent", () => {
  const footer = "[ Prompt: 200 t/s | eval: 60 t/s ]";
  expect(parseTurnMetrics(footer)).toEqual({
    promptTokensPerSec: 200,
    evalTokensPerSec: 60,
    draftAccepted: null,
    draftProposed: null
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime`
Expected: FAIL — `draftAccepted` not in returned shape.

- [ ] **Step 3: Implement**

Extend `TurnMetrics` and `parseTurnMetrics`:

```typescript
export type TurnMetrics = {
  promptTokensPerSec: number | null;
  evalTokensPerSec: number | null;
  draftAccepted: number | null;
  draftProposed: number | null;
};

export function parseTurnMetrics(footer: string): TurnMetrics {
  const num = (re: RegExp): number | null => {
    const m = re.exec(footer);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };
  const draftPair = /draft[^\]|]*?([\d.]+)\s*\/\s*([\d.]+)/i.exec(footer);
  const draftAccepted = draftPair ? Number(draftPair[1]) : null;
  const draftProposed = draftPair ? Number(draftPair[2]) : null;
  return {
    promptTokensPerSec: num(/prompt[^\]|]*?([\d.]+)\s*t\/s/i),
    evalTokensPerSec: num(/(?:predicted|eval|generation|gen)[^\]|]*?([\d.]+)\s*t\/s/i),
    draftAccepted: Number.isFinite(draftAccepted as number) ? draftAccepted : null,
    draftProposed: Number.isFinite(draftProposed as number) ? draftProposed : null
  };
}
```

Update the perf-log call site in `waitForTurnFooter`:

```typescript
if (process.env["WRITER_LOCAL_PERF_LOG"] === "1") {
  const metrics = parseTurnMetrics(m[0]);
  const tail = metrics.draftAccepted !== null && metrics.draftProposed !== null
    ? `, draft ${metrics.draftAccepted}/${metrics.draftProposed} accepted`
    : "";
  console.error(
    `[local-gemma] prompt ${metrics.promptTokensPerSec ?? "?"} t/s, ` +
    `eval ${metrics.evalTokensPerSec ?? "?"} t/s${tail}`
  );
}
```

The existing 4 `parseTurnMetrics` tests will need their `toEqual` shapes updated to include `draftAccepted: null, draftProposed: null` (find them in the test file and add the two new fields to each expected object).

- [ ] **Step 4: Run test + typecheck**

Run: `npm --workspace @writer/agent-adapters run test -- local-gemma-runtime && npm --workspace @writer/agent-adapters run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-adapters/src/adapters/local-gemma-runtime.ts packages/agent-adapters/src/adapters/local-gemma-runtime.test.ts
git commit -m "feat(local-gemma): extend parseTurnMetrics with optional draft acceptance"
```

---

## Task 10: Desktop UI — Speed boost section

**Files:**
- Create: `apps/desktop/src/settings/SpeedBoostSection.tsx`
- Create: `apps/desktop/src/settings/SpeedBoostSection.test.tsx`
- Modify: wherever the Local Gemma Settings section is composed (grep for the existing Local Gemma settings panel)

- [ ] **Step 1: Write the failing render test**

In `SpeedBoostSection.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { SpeedBoostSection } from "./SpeedBoostSection";

describe("SpeedBoostSection", () => {
  it("renders Install button when not installed", () => {
    render(<SpeedBoostSection status={{ installed: false, enabled: false }} onInstall={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: /install draft model/i })).toBeInTheDocument();
  });
  it("renders toggle off when installed and disabled", () => {
    render(<SpeedBoostSection status={{ installed: true, enabled: false }} onInstall={vi.fn()} onToggle={vi.fn()} />);
    const toggle = screen.getByRole("switch", { name: /speculative decoding/i });
    expect(toggle).not.toBeChecked();
  });
  it("renders toggle on when enabled", () => {
    render(<SpeedBoostSection status={{ installed: true, enabled: true }} onInstall={vi.fn()} onToggle={vi.fn()} />);
    const toggle = screen.getByRole("switch", { name: /speculative decoding/i });
    expect(toggle).toBeChecked();
  });
  it("renders banner with lastError", () => {
    render(<SpeedBoostSection status={{ installed: true, enabled: false, lastError: "Insufficient VRAM" }} onInstall={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.getByText(/Insufficient VRAM/)).toBeInTheDocument();
  });
  it("fires onToggle when the switch is clicked", () => {
    const onToggle = vi.fn();
    render(<SpeedBoostSection status={{ installed: true, enabled: false }} onInstall={vi.fn()} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch", { name: /speculative decoding/i }));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace @writer/desktop run test -- SpeedBoostSection`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// apps/desktop/src/settings/SpeedBoostSection.tsx
import * as React from "react";

export type DraftStatus = {
  installed: boolean;
  enabled: boolean;
  lastError?: string;
};

export type SpeedBoostSectionProps = {
  status: DraftStatus;
  onInstall: () => void;
  onToggle: (next: boolean) => void;
};

export function SpeedBoostSection({ status, onInstall, onToggle }: SpeedBoostSectionProps): React.ReactElement {
  return (
    <section aria-label="Speed boost">
      <h3>Speed boost</h3>
      {!status.installed && (
        <button type="button" onClick={onInstall}>
          Install draft model (~500 MB)
        </button>
      )}
      {status.installed && (
        <label>
          <input
            type="checkbox"
            role="switch"
            aria-label="Speculative decoding"
            checked={status.enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Speculative decoding
        </label>
      )}
      {status.lastError && (
        <div role="alert">{status.lastError}</div>
      )}
    </section>
  );
}
```

Visual polish (Carbon design system) is intentionally minimal here — the integrating Settings page (next step) wraps this in the project's existing visual primitives.

- [ ] **Step 4: Wire into the existing Local Gemma Settings panel**

Grep for the Local Gemma Settings component (likely `apps/desktop/src/settings/LocalGemmaSettings.tsx` or similar). Add the new section beneath the model-install controls. Wire `onInstall` to `POST /local-model/draft/install`, `onToggle` to `PUT /local-model/draft/enabled`, and read `status` from the existing adapter-status query.

- [ ] **Step 5: Run test + typecheck**

Run: `npm --workspace @writer/desktop run test -- SpeedBoostSection && npm --workspace @writer/desktop run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/settings/SpeedBoostSection.tsx apps/desktop/src/settings/SpeedBoostSection.test.tsx
git add apps/desktop/src/settings/  # any integrating files
git commit -m "feat(desktop): add Speed boost section to Local Gemma settings"
```

---

## Task 11: Full verification

**Files:** none (validation only)

- [ ] **Step 1: Repo-wide typecheck and tests**

Run: `npm run typecheck && npm run test`
Expected: PASS across all workspaces (the 6 pre-existing Windows-specific failures in cli-runner/registry/create-cli-adapter and pre-existing daemon failures unrelated to local-gemma still exist — confirm no new failures in `local-gemma-*`, `local-models`, `store`, or `SpeedBoostSection`).

- [ ] **Step 2: Validate the OpenSpec change**

Run: `npx openspec validate add-speculative-decoding --type change --strict`
Expected: `Change 'add-speculative-decoding' is valid`.

- [ ] **Step 3: Manual benchmark (live GPU) — speed**

1. Start daemon with `WRITER_LOCAL_PERF_LOG=1`.
2. In Settings → Local Gemma → Speed boost, click "Install draft model" and wait for completion.
3. Toggle "Speculative decoding" ON.
4. Send 5 chat turns; record each turn's perf-log line.
5. **Expected:** eval t/s rises from ~40 baseline to **≥52 t/s average** (≥30% improvement). If the binary supports it, the log line also shows `draft N/M accepted`.

- [ ] **Step 4: Manual fallback test — VRAM oversubscription**

1. Set `WRITER_LOCAL_UBATCH=4096` (intentionally oversubscribe).
2. Restart daemon, re-enable toggle, send a chat turn.
3. **Expected:** Settings banner appears with the VRAM error message; chat completes at non-speculative baseline (~40 t/s).
4. Unset the env override; restart; confirm normal operation resumes.

- [ ] **Step 5: Manual toggle-off test**

1. Toggle "Speculative decoding" OFF.
2. Send a chat turn.
3. **Expected:** perf log shows no draft line; eval t/s returns to baseline ~40 t/s. Confirms the toggle actually controls runtime behavior.

- [ ] **Step 6: Mark tasks complete and commit**

```bash
git add openspec/changes/add-speculative-decoding/tasks.md
git commit -m "chore(openspec): mark add-speculative-decoding tasks complete"
```

---

## Self-Review Notes

- **Spec coverage:** Both ADDED requirements from `specs/agent-adapter-runtime/spec.md` are covered (Task 5 = wiring, Task 6 = fallback). Both ADDED requirements from `specs/local-model-runtime/spec.md` are covered (Task 1 = manifest, Task 3 = install with SHA verify + idempotency).
- **Placeholder scan:** One legitimate placeholder remains in Task 1 Step 5 — the draft model's `url`/`sha256`/`sizeBytes`/`fileName`. The implementer is told explicitly to either replace with real values from Hugging Face before merge, or omit the field and surface DONE_WITH_CONCERNS. This is the only intentional gap.
- **Type consistency:** `DraftSettings = { enabled: boolean; path: string | null }` is used consistently across Tasks 5, 6, 8. `DraftModelManifest` (Zod schema) is exported once in Task 1 and consumed in Task 3. `TurnMetrics` in Task 9 extends the existing two fields with two new nullable fields — existing test fixtures need updating, called out in Task 9 Step 3.
- **Dependency on prior changes:** Plan assumes `expand-local-context-window` and `tune-local-inference-speed` are archived; the runtime file's `buildSpawnArgs`, `parseTurnMetrics`, `resolveCtxSize`, etc. all exist. Verified against the live `local-gemma-runtime.ts` while writing.
- **Eviction-on-toggle:** Task 8 names `shutdownLocalGemmaRuntime` based on the existing SIGINT handler. If that function lives under a different name, the implementer should grep for the SIGINT wire-up and use whatever the existing eviction entry point is — explicitly called out in the task body.
- **Cold-spawn scope:** Task 7 deliberately limits cold-spawn draft to env-only. The cold-spawn path is a fallback when the resident runtime crashes — passing storage settings there would couple two layers that today only intersect via env. Documented in the proposal's "Cold-spawn parity" section.
