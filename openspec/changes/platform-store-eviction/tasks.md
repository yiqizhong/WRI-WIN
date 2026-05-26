<!-- Linear: WRI-150 epic · WRI-151 [spreadsheet-attachment-disk-ref] · WRI-152 [store-eviction] · WRI-153 [renderer-polling-stability] -->

## 1. Contracts (no impl risk, unblocks all other tasks)

- [x] 1.1 `packages/contracts/src/paste-text.ts` — make `parseResult` optional; add optional `parseResultPath: string` to `pasteTextAttachmentSchema`
- [x] 1.2 `packages/contracts/src/agent.ts` — make `prompt` optional on `agentRunSchema` (`z.string().optional()`)
- [x] 1.3 Run `npm run typecheck && npm run test --workspace @writer/contracts` — must pass

## 2. Storage eviction (daemon-side, no disk-ref yet)

- [x] 2.1 Add `AUDIT_LOG_CAP = 10_000` constant and FIFO trim inside `appendAuditEntry` in `packages/storage/src/store.ts`
- [x] 2.2 Add `purgeAgentRunEvents(runId: string): void` method to `PlatformStore`
- [x] 2.3 Add load migration in `store.load()`: for each completed/failed/canceled run, call `purgeAgentRunEvents(runId)` on all matching events, then `save()` once
- [x] 2.4 Add Vitest tests for `purgeAgentRunEvents`, auditLog cap, and migration — run `npm run test --workspace @writer/storage`

## 3. Spreadsheet attachment disk-ref

- [x] 3.1 In `apps/daemon/src/paste-text.ts` — `attachPasteTextFile`: write `parseResult` JSON to `~/.writer/conversations/<id>/attachment-parse-result.json` via `mkdir + writeFile`; set `parseResultPath`; do not set `parseResult` on the saved attachment
- [x] 3.2 In `apps/daemon/src/paste-text.ts` — `sendPasteTextMessage`: when `rowIndex` is set, read `parseResultPath` from disk instead of `parseResult` from attachment; parse and discard after building row context
- [x] 3.3 In `packages/storage/src/store.ts` — `load()` migration: for conversations with inline `parseResult` and no `parseResultPath`, write to disk and update in-memory record; save once after all migrations
- [x] 3.4 Add Vitest tests for attach (writes file, clears inline), send with rowIndex (reads file), migration — `npm run test --workspace @writer/daemon`
- [x] 3.5 Run `npm run typecheck` — confirm no type errors on the now-optional `parseResult` field at all callsites

## 4. Agent run — stop persisting prompt

- [x] 4.1 In `packages/agent-adapters/src/create-cli-adapter.ts` — remove `prompt: request.prompt` from the `run` object literal in `runCliAdapter`
- [x] 4.2 Run `npm run typecheck && npm run test --workspace @writer/agent-adapters`

## 5. Renderer polling stability

- [x] 5.1 In `apps/desktop/src/paste-text-chat-runtime/use-paste-text-chat-runtime.ts` — wrap the inline `onConversationChange` arrow passed to `usePasteTextRunSync` in `useCallback([onConversationChange])`
- [x] 5.2 Run `npm run typecheck && npm run test --workspace @writer/desktop`

## 6. Integration + verification

- [x] 6.1 Run full test suite: `npm run test`
- [x] 6.2 Manual verify: start daemon, attach a 1,000-row CSV, send a message, confirm `~/.writer/conversations/*/attachment-parse-result.json` exists and `platform-store.json` has no inline `parseResult`
- [x] 6.3 Manual verify: run an agent rewrite, wait for completion, confirm `agentRunEvents` is empty in `platform-store.json` and no `prompt` field on the run record
- [x] 6.4 Manual verify: open Network panel in DevTools, send a message, confirm `/paste-text/conversations/:id` polls at ~500 ms (not sub-100 ms)
- [x] 6.5 Run `openspec validate platform-store-eviction --type change --strict` (if CLI supports)
