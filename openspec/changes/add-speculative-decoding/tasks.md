## 1. Manifest + contracts

- [ ] 1.1 Add optional `draftModel: { url, sha256, sizeBytes, fileName }` to the manifest schema in `apps/daemon/src/local-model-manifest.ts`; populate for Gemma 4 E4B with Google's official draft.
- [ ] 1.2 Extend the adapter status DTO in `packages/contracts` with `draftModel: { installed: boolean, enabled: boolean, lastError?: string }` (optional field; backwards-compatible).
- [ ] 1.3 Unit tests: manifest with/without `draftModel` both validate; missing field defaults to `undefined`.

## 2. Storage migration

- [ ] 2.1 Add `localGemma.speculativeDecoding = { enabled: boolean, lastError?: string }` slice in `packages/storage` with default `{ enabled: false }`.
- [ ] 2.2 Migration: existing storage without the slice loads as default; existing storage with stray keys is preserved.
- [ ] 2.3 Unit tests: migration path for empty store, partial store, full store.

## 3. Install flow

- [ ] 3.1 Add `installDraftModel(modelId)` action in `apps/daemon/src/local-model-install.ts` (or equivalent): stream to `.partial`, SHA-verify, atomic rename, persist path.
- [ ] 3.2 Idempotency: second call with existing matching file is a no-op; mismatched SHA fails without overwriting.
- [ ] 3.3 Add `POST /local-model/draft/install` and `PUT /local-model/draft/enabled` routes.
- [ ] 3.4 Unit tests: successful install, idempotent re-run, SHA mismatch, partial-file cleanup on abort.

## 4. Runtime resolver + spawn args (agent-adapters)

- [ ] 4.1 Add `resolveDraftModelPath(envOverride, settings)` pure helper in `local-gemma-runtime.ts`. Precedence: env → settings (enabled + path) → null.
- [ ] 4.2 Extend `buildSpawnArgs` input with `draftModelPath: string | null`; append `--model-draft <path>` when non-null. Apply on cold-spawn fallback in `local-gemma-adapter.ts`.
- [ ] 4.3 Wire `spawnProcess` to pass `resolveDraftModelPath(process.env["WRITER_LOCAL_DRAFT_MODEL"], settings)` (settings threaded via `ensureProcess` input).
- [ ] 4.4 Unit tests: resolver env-wins/settings-respected/toggle-off/empty → null; `buildSpawnArgs` carries `--model-draft` when set, omits when null; cold-spawn args carry the flag.

## 5. Draft-load fallback

- [ ] 5.1 Add `isDraftLoadFailure(stderr)` detector in `local-gemma-runtime.ts`: matches the llama-cli VRAM/allocation error signature naming the draft path.
- [ ] 5.2 On detected failure where the draft came from settings (not env), respawn once without `--model-draft`, set `draftFallbackUsed` for the runtime's lifetime, persist `lastError` to storage, emit `draftModelDisabled` event.
- [ ] 5.3 An explicit `WRITER_LOCAL_DRAFT_MODEL` env disables auto-fallback (surface the error instead).
- [ ] 5.4 Unit tests: detector matches real error string and tolerates CRLF; fallback path simulated end-to-end with mocked spawn; env-override disables auto-fallback.

## 6. Perf-log extension (optional acceptance rate)

- [ ] 6.1 Extend `parseTurnMetrics` to also extract draft acceptance counts when llama-cli exposes them in the footer (e.g. `draft accepted N/M`); nulls when absent.
- [ ] 6.2 When `WRITER_LOCAL_PERF_LOG=1` and acceptance counts are present, append them to the existing log line.
- [ ] 6.3 Unit tests: parser tolerates footer with and without acceptance counts; log line stays well-formed.

## 7. Desktop UI

- [ ] 7.1 Settings → Local Gemma → new "Speed boost" sub-section.
- [ ] 7.2 Not-installed state: "Install draft model (~500 MB)" button → triggers install flow with progress; hides when installed.
- [ ] 7.3 Installed state: "Speculative decoding" toggle; PUT to `/local-model/draft/enabled` on change; reuses the existing runtime-eviction pattern so the next turn picks it up.
- [ ] 7.4 Banner: when `lastError` is set, render the message with [Retry] / [Disable] buttons.
- [ ] 7.5 Unit tests for the section's pure rendering logic (state → JSX); no full E2E required at this layer.

## 8. Verification

- [ ] 8.1 `npm run typecheck` and `npm run test` pass across workspaces.
- [ ] 8.2 `npx openspec validate add-speculative-decoding --type change --strict` → valid.
- [ ] 8.3 Manual (live GPU): install draft, toggle on, send chat turns with `WRITER_LOCAL_PERF_LOG=1`. Record eval t/s before vs after. Expected: ≥30% rise; target 55–70 t/s.
- [ ] 8.4 Manual: oversubscribe VRAM (e.g. `WRITER_LOCAL_UBATCH=4096`) to force draft-load failure; confirm banner appears, fallback engages, chat continues at non-speculative baseline.
- [ ] 8.5 Manual: toggle off; confirm next turn reverts to non-speculative baseline.
