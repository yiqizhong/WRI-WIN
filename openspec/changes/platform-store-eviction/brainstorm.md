# Brainstorm — platform-store-eviction

> Source: `/investigate` session on branch `investigate/electron-memory-leaks`, 2026-05-25.
> Root cause confirmed via static analysis of `packages/storage/src/store.ts` and related files.

---

## Background

After extended use, the Electron app (daemon + renderer) grows to 10+ GB of RAM.
The investigation traced the growth to `PlatformStore` in the daemon — a single
in-memory JSON snapshot with no eviction, cap, or pruning on any of its arrays.

---

## Decision chain

### Q1 — Where does the memory actually accumulate?

`PlatformStore.snapshot` (packages/storage/src/store.ts) holds every entity the
daemon has ever created. Five collections grow without bound:

| Collection | Growth pattern | Size per unit |
|---|---|---|
| `agentRunEvents` | One event per LLM output line, never deleted | ~200 B each |
| `auditLog` | Appended on every operation, never capped | ~300 B each |
| `agentRuns` | One record per run; stores the **full prompt** | 50–200 KB each |
| `pasteTextConversations` | Stores full spreadsheet `parseResult` inline | MB-scale per convo |
| `sessions.scope` | Stores Figma extraction nodes + design context | up to 10 MB per session |

**Highest-risk item:** `PasteTextAttachment.parseResult` stores the entire parsed
spreadsheet (all rows × all cells) as a JSON object inside the conversation. A
10,000-row spreadsheet = ~5 MB; 2,000 conversations = ~10 GB.

### Q2 — Is this daemon memory or renderer memory?

Both, but the daemon is primary:
- Daemon: `PlatformStore.snapshot` is a live JavaScript object in the Node.js heap.
  V8 heap RSS does not shrink when entries are added and the file grows.
- Renderer: every 500 ms poll via `usePasteTextRunSync` fetches the full conversation
  over HTTP (including the large `parseResult`), triggering rapid allocation of large
  objects in the renderer heap. Chromium's renderer memory tracks this indirectly.

Additionally, an unstable `onConversationChange` reference in `usePasteTextRunSync`
(apps/desktop/src/paste-text-chat-runtime/use-paste-text-run-sync.ts:93) re-fires
the polling effect on every render during an active run, amplifying the issue.

### Q3 — What's the right fix shape?

Three categories:

**Category A — Store the data differently (no contract change):**
- Move `attachment.parseResult` out of the conversation object; write to disk;
  store only a file-path reference (same pattern as `frameScreenshots`).
- Rationale: parseResult is needed at send-time (to build row context), not
  at conversation-read time. We can re-read from disk on demand.

**Category B — Evict / cap data that is not needed after completion (contract change):**
- `agentRunEvents`: purge on run completion; events are only needed while
  a run is active (the renderer polls them for streaming display).
- `auditLog`: cap at 10,000 entries with a FIFO trim.
- `agentRuns.prompt`: do not persist the full prompt; it is an input-only
  artefact that is never read back after the run.

**Category C — Renderer fix (no contract change):**
- Memoize `onConversationChange` in `usePasteTextChatRuntime` with `useCallback`
  to stabilize the reference used in `usePasteTextRunSync`'s dependency array.

### Q4 — Does removing `agentRuns.prompt` break any consumer?

`prompt` is defined in the `AgentRun` contract (`packages/contracts/src/agent.ts`).
Search confirms no consumer reads it back after a run starts; it is only written.
Making it optional (`prompt?: string`) is a backwards-compatible contract change.

### Q5 — Does moving `parseResult` to disk break the row-context path?

`sendPasteTextMessage` reads `conversation.attachment.parseResult` at lines 287–294
of `apps/daemon/src/paste-text.ts`. If we store the path instead, that one callsite
reads from disk on demand. This is safe — sendPasteTextMessage is already async.

### Q6 — Slice boundaries?

Three independent slices with clear ownership:
1. **Fix-spreadsheet-attachment** — daemon + contracts (high urgency)
2. **Fix-store-eviction** — daemon store only; no contract change needed for
   auditLog/events, but `agentRuns.prompt` needs a contract change (medium urgency)
3. **Fix-renderer-polling** — desktop only; one `useCallback` (low urgency but cheap)

---

## Design trade-offs

| Option | Pro | Con |
|---|---|---|
| Move parseResult to disk (chosen) | Eliminates the biggest single source; consistent with screenshot pattern | Adds one disk read per `sendPasteTextMessage` |
| Compress parseResult in store | Keeps single-file store | Still grows; complicates load/save |
| Drop parseResult after first use | Simple | Breaks re-attachment flow if user sends multiple messages to same conversation |
| Cap agentRunEvents per run (instead of purge) | Keeps some history | Still grows across many runs |
| Purge agentRunEvents on completion (chosen) | Eliminates growth entirely | No post-run event history (not needed by current UI) |
