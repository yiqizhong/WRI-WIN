# Tasks — improve-robustness-and-efficiency

> Each top-level section maps to one Linear child issue (see `docs/linear-openspec-map.md`).
> Severity from the verified audit (`docs/code-quality-audit-2026-06-09.md`).
> Every task closes with: `npm run typecheck`, `npm run test`, `npx openspec validate improve-robustness-and-efficiency --type change --strict`.

## 1. R1 — Download resume integrity (MEDIUM · local-daemon)

- [ ] 1.1 `local-models.ts` `runDownload`: derive `resumeFrom` from `stat(tmp)` (actual file size), not the stored `downloadedBytes`.
- [ ] 1.2 Require HTTP **206** when `resumeFrom > 0`; on a **200** (Range ignored), truncate and restart at 0.
- [ ] 1.3 Tests: resume after a simulated mid-download cut produces a SHA-valid file; a 200-on-resume is handled without corruption.

## 2. E1 — Bounded store writes (MEDIUM · store-eviction / review-session-storage)

- [ ] 2.1 `store.ts` `writeSnapshotToDisk`: drop `null, 2` pretty-print for the machine-read file.
- [ ] 2.2 Debounce/coalesce `save()` (short trailing debounce; the existing `saveChain` already serializes writes).
- [ ] 2.3 (stretch) Move append-only collections (`auditLog`, `agentRunEvents`) out of the monolithic snapshot into append-only files.
- [ ] 2.4 Tests: a burst of mutations collapses to one (or few) disk writes; persisted state is unchanged on reload.

## 3. E3 — Run-status polling (MEDIUM · renderer-polling-stability)

- [ ] 3.1 Raise the run-status poll interval to ~500ms–1s (`paste-text-chat-panel.tsx`).
- [ ] 3.2 Add an in-flight guard so a slow poll cannot stack overlapping requests.
- [ ] 3.3 Dedupe the two implementations (`paste-text-chat-panel.tsx` vs `use-paste-text-run-sync.ts`) into one.
- [ ] 3.4 Tests: no overlapping in-flight polls under simulated latency; status still converges on completion.

## 4. E2 — Cache GPU device detection (LOW/backlog · agent-adapter-runtime)

- [ ] 4.1 `local-gemma-adapter.ts` `detect()`: reuse a cached `listGpuDevices` result (mirror `detectNvidiaVram`'s cache) instead of re-spawning `llama-cli --list-devices`.
- [ ] 4.2 Tests: repeated `detect()` calls spawn the device probe at most once (until invalidated).

## 5. E4 — Stream download writes (LOW/backlog · local-daemon)

- [ ] 5.1 `local-models.ts`: replace the per-chunk awaited `write` loop with `stream/promises pipeline()` over `Readable.fromWeb(response.body)`.
- [ ] 5.2 Tests: download still verifies; progress/abort semantics preserved.

## 6. R2 — Surface save errors (LOW/backlog · store-eviction)

- [ ] 6.1 Replace the one fire-and-forget `void state.store.save()` (`apps/daemon/src/review.ts:239`) with an awaited/handled save, and add a central save-error surface (log + status).
- [ ] 6.2 Tests: a simulated write failure is observable, not silently dropped.

## 7. R3 — Resident runtime lifecycle on model change (LOW/backlog · agent-adapter-runtime)

- [ ] 7.1 `local-gemma-adapter.ts`: key the resident runtime on `modelPath`/`binary`, or have `resetModelDownload` call `shutdownLocalGemmaRuntime()`.
- [ ] 7.2 Tests: after a model reset, the next run does not reuse a stale resident process.
