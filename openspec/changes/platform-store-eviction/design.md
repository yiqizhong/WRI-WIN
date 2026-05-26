# Design — platform-store-eviction

## Context

`PlatformStore` is the daemon's single-source-of-truth: a JSON object loaded from
`~/.writer/platform-store.json` into the Node.js heap at startup and kept there
for the process lifetime. Every mutation goes through a chainable `store.save()`
that atomically writes the whole snapshot to disk.

This design is sound for small datasets (projects, sessions, changes) but becomes
pathological for high-volume write-only data:

- **`agentRunEvents`**: one event per LLM output line, appended on every streaming
  tick, never deleted. A moderately long Claude Code run produces 200–1,000 events.
- **`auditLog`**: appended on every operation (run lifecycle, permission decision,
  tool attempt). Two to four entries per agent run, unbounded.
- **`agentRuns.prompt`**: the full assembled prompt (guidelines + history + text)
  stored per run — 50–200 KB each — read back by nothing.
- **`pasteTextConversations[].attachment.parseResult`**: the entire spreadsheet
  (all rows, all cells) stored as a nested JSON object in the conversation. The
  biggest single source of growth: one 10,000-row spreadsheet = ~5 MB; 2,000
  conversations = ~10 GB.

## Goals

1. Eliminate 10 GB+ growth from spreadsheet parseResult stored inline.
2. Evict agentRunEvents and cap auditLog to prevent long-term linear growth.
3. Stop persisting the agent run prompt — it is never read back.
4. Stabilise the renderer polling callback to stop accidental re-triggers.

## Decisions

### D1 — parseResult: write to disk, store only the path

Pattern mirrors `captureSessionFrameScreenshots` (apps/daemon/src/figma-screenshots.ts),
which already writes PNG bytes to `~/.writer/sessions/<id>/screenshots/` and stores
only `{ frameId, fileRef }` in the session.

New approach for spreadsheet attachments:
- On `attachPasteTextFile`, parse the spreadsheet → write JSON to
  `~/.writer/conversations/<conversationId>/attachment-parse-result.json` → store
  `parseResultPath` in the attachment (no `parseResult` in memory / store).
- On `sendPasteTextMessage`, if `rowIndex` is set, `fs.readFile(parseResultPath)`
  to get the parse result, build row context, then discard the in-memory copy.
- On store load, migrate any existing conversation that has an inline `parseResult`
  by writing it to disk and replacing with `parseResultPath`.

Contract change: `parseResult` becomes `optional` in `PasteTextAttachmentSchema`;
new optional `parseResultPath: string` field added.

### D2 — agentRunEvents: purge on terminal status

`consumeAgentRun` (apps/daemon/src/agents.ts:208) is the single completion point.
Add `state.store.purgeAgentRunEvents(runId)` immediately after the `for await`
loop, before the final `save()`. New store method:

```typescript
purgeAgentRunEvents(runId: string): void {
  this.snapshot.agentRunEvents = this.snapshot.agentRunEvents.filter(
    (e) => e.runId !== runId
  );
}
```

On store load, migrate: purge events for all runs that are already in terminal status.
This one-time migration cleans existing data.

### D3 — auditLog: FIFO cap at 10,000

After each `appendAuditEntry`, trim the oldest entries if length > 10,000:

```typescript
if (this.snapshot.auditLog.length > AUDIT_LOG_CAP) {
  this.snapshot.auditLog.splice(0, this.snapshot.auditLog.length - AUDIT_LOG_CAP);
}
```

`AUDIT_LOG_CAP = 10_000` as a named constant. No contract change needed.

### D4 — agentRuns.prompt: make optional, stop writing

`AgentRun` in `packages/contracts/src/agent.ts` gains `prompt?: string` (was
`prompt: string`). In `runCliAdapter` (packages/agent-adapters/src/create-cli-adapter.ts),
remove `prompt: request.prompt` from the `run` object. On load, `agentRunSchema`
already drops unknown fields via Zod's default `strip` mode, so existing records
with a `prompt` field will continue to parse.

Migration: no active migration needed — old `prompt` fields are silently stripped
by Zod on the next `store.load()`.

### D5 — renderer: wrap onConversationChange in useCallback

`usePasteTextChatRuntime` passes an inline arrow to `usePasteTextRunSync` which
lists it in the effect dependency array. Every parent re-render (triggered by
`setStreamingText` etc.) recreates the arrow → effect restarts → immediate extra
poll → more state updates → cycle.

Fix: wrap the arrow in `useCallback` with `[onConversationChange]` as its dep,
so the reference is stable as long as the parent's callback is stable.

## Risks

| Risk | Mitigation |
|---|---|
| Disk write on attach fails (disk full / permissions) | Propagate error to caller as HTTP 500; UI shows existing error toast |
| Migration writes parseResult to disk and crashes mid-way | Load migration is idempotent: if `parseResultPath` exists on disk, skip; if `parseResult` is present but file missing, write it then clear inline copy |
| purgeAgentRunEvents races with a concurrent poll | poll runs entirely on the daemon thread (Node.js single-threaded); no true race |
| Existing stores with many stale events are large to migrate | Migration filters the array once in-place on startup; O(n) scan, fast |

## Migration plan

All migrations run inside `store.load()`, before returning:
1. For each `pasteTextConversation` with an inline `parseResult` and no `parseResultPath`:
   write JSON to disk, set `parseResultPath`, clear `parseResult`.
2. For each `agentRun` with `status` in `{completed, failed, canceled}`:
   purge all events for that `runId` from `agentRunEvents`.
3. Call `save()` once after migrations complete.
