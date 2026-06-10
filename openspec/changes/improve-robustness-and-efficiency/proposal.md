# Improve robustness and efficiency

## Why

The 2026-06-09 full-codebase audit (`docs/code-quality-audit-2026-06-09.md`, verified +
cross-checked) found several non-security robustness/efficiency issues. The three that users
actually feel:

- **R1 (MED, robustness)** — model-download resume can corrupt the `.tmp`: there is no check
  that a resume got HTTP **206** before appending, and the store's `downloadedBytes` (saved every
  2s) under-counts the real `.tmp` after a mid-download error/crash → duplicated bytes. The SHA
  guard prevents a *bad install*, but the user re-downloads the whole multi-GB model.
- **E1 (MED, efficiency)** — every store mutation rewrites the entire snapshot
  (`JSON.stringify(…, null, 2)` + full-file write), including the `auditLog` (capped at 10k).
  The daemon `await`s this before responding, so the app feels slower as the store grows.
- **E3 (MED, efficiency)** — the chat panel polls run status **10×/second** (`setInterval(poll, 100)`)
  with no in-flight guard, and a parallel 500ms implementation exists. Battery/CPU drain during
  runs; request pileup under latency.

Backlog (LOW): E2 (uncached `listGpuDevices` spawn in `detect()`), E4 (per-chunk awaited download
write), R2 (one fire-and-forget save error not surfaced), R3 (resident runtime not keyed on model
path / not evicted on reset).

## What Changes

- **local-daemon**: download resume derives the offset from `stat(tmp)` and requires a 206 before
  appending (else truncate + restart at 0); optionally switch the write loop to `stream/promises
  pipeline()`.
- **store-eviction / review-session-storage**: drop `null, 2` pretty-print for the machine file;
  debounce/coalesce `save()`; surface the one fire-and-forget save error; consider moving
  append-only collections (`auditLog`, `agentRunEvents`) out of the monolithic snapshot.
- **renderer-polling-stability**: raise the run-status poll interval to ~500ms–1s, add an
  in-flight guard (skip a tick while a poll is outstanding), and dedupe the two implementations.
- **agent-adapter-runtime**: cache `listGpuDevices` in `detect()` like `detectNvidiaVram` does;
  evict the resident runtime on model reset / key it on `modelPath`.

Spec deltas under `specs/<capability>/spec.md` are authored per finding at implementation time.

## Impact

- **Affected specs:** `local-daemon`, `store-eviction`, `review-session-storage`,
  `renderer-polling-stability`, `agent-adapter-runtime`.
- **Affected code:** `apps/daemon/src/local-models.ts`, `packages/storage/src/store.ts`,
  `apps/desktop/src/paste-text-chat-panel.tsx`,
  `apps/desktop/src/paste-text-chat-runtime/use-paste-text-run-sync.ts`,
  `packages/agent-adapters/src/adapters/local-gemma-adapter.ts`.
- **User-visible improvements:** interrupted downloads resume instead of restarting (R1), lower
  battery/CPU during runs (E3), the app stays responsive as it ages (E1). No behavior change for
  the backlog items.
