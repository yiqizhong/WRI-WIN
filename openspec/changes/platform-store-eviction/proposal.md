# Proposal — platform-store-eviction

## Why

After extended use the Electron app grows to 10+ GB of RAM. The root cause is
`PlatformStore` (packages/storage/src/store.ts): a single JSON snapshot held
entirely in the Node.js heap with no eviction, cap, or pruning on any collection.
The highest-risk item is `PasteTextAttachment.parseResult` — a full spreadsheet
parse (all rows × cells) stored inline in every conversation, sent over HTTP on
every 500 ms poll, and never cleaned up.

## What Changes

### Capability A — spreadsheet-attachment-disk-ref (new)
Move `PasteTextAttachment.parseResult` out of the in-memory store and onto disk.
The conversation stores only a `parseResultPath` reference; the daemon reads the
file on demand when building the row context for a new message.

- **In scope:** `packages/contracts` schema update (add `parseResultPath?: string`,
  make `parseResult` optional), `packages/storage` store method, `apps/daemon`
  attach + send paths, `packages/storage` load migration for existing records.
- **Out of scope:** UI changes; other attachment kinds (plain_text is small).

### Capability B — store-eviction (new)
Add eviction and caps to three high-growth collections inside `PlatformStore`:

1. **`agentRunEvents`** — purge all events for a run immediately after the run
   reaches a terminal status (`completed | failed | canceled`). Events are only
   consumed during active polling; post-run they are never read.
2. **`auditLog`** — trim to the last 10,000 entries after each append (FIFO).
3. **`agentRuns.prompt`** — make optional in the `AgentRun` contract; do not
   write it to the store (prompt is write-only input, never read back).

- **In scope:** `packages/contracts` AgentRun schema, `packages/storage` store
  methods, `apps/daemon` agents.ts run completion, load migration (strip existing
  prompts on next load).
- **Out of scope:** per-session change/finding eviction (separate concern).

### Capability C — renderer-polling-stability (new)
Stabilize the `onConversationChange` callback passed to `usePasteTextRunSync` to
prevent polling-effect restarts on every render during an active run.

- **In scope:** `apps/desktop/src/paste-text-chat-runtime/use-paste-text-chat-runtime.ts`.
- **Out of scope:** other hooks; polling interval changes.

## Capabilities

| Capability | Spec file | Type |
|---|---|---|
| `spreadsheet-attachment-disk-ref` | specs/spreadsheet-attachment-disk-ref/spec.md | New |
| `store-eviction` | specs/store-eviction/spec.md | New |
| `renderer-polling-stability` | specs/renderer-polling-stability/spec.md | New |

## Impact

| Area | Files touched |
|---|---|
| packages/contracts | agent.ts (prompt optional), paste-text.ts (parseResultPath) |
| packages/storage | store.ts (purgeAgentRunEvents, auditLog trim, load migration) |
| apps/daemon | paste-text.ts (attach + send paths), agents.ts (post-run purge) |
| apps/desktop | use-paste-text-chat-runtime.ts (useCallback wrap) |

**No renderer API or IPC surface changes.** Daemon HTTP responses shrink because
`getPasteTextConversation` no longer returns multi-MB parseResult payloads.
