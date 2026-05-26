# renderer-polling-stability Specification

## Purpose
TBD - created by archiving change platform-store-eviction. Update Purpose after archive.
## Requirements
### Requirement: Stable onConversationChange for run sync

`usePasteTextChatRuntime` SHALL pass a referentially stable callback to `usePasteTextRunSync`.

#### Scenario: Streaming re-renders do not change callback identity

- **WHEN** the chat runtime re-renders due to `streamingText`, `runStatus`, or `runEvents` updates
- **THEN** the `onConversationChange` reference passed to `usePasteTextRunSync` is unchanged between those renders

#### Scenario: useCallback dependency

- **WHEN** the wrapper callback is created
- **THEN** it uses `useCallback` with `[onConversationChange]` as dependencies

### Requirement: Poll interval not amplified by effect restarts

While a rewrite is pending, conversation polling SHALL run on a single interval per pending message.

#### Scenario: Effect does not restart on streaming updates

- **WHEN** an assistant message is `pending` and the parent re-renders repeatedly during streaming
- **THEN** `usePasteTextRunSync` does not clear and recreate its polling timer on each render

#### Scenario: Poll interval about five hundred milliseconds

- **WHEN** polling is active for a pending assistant message
- **THEN** `GET /paste-text/conversations/:id` (and linked run fetches) are driven on `RUN_POLL_INTERVAL_MS` (500 ms), not sub-100 ms bursts from effect churn

### Requirement: Functional equivalence after stabilization

Stabilizing the callback SHALL not change completion behavior.

#### Scenario: Run completion still updates conversation

- **WHEN** a run completes and the sync hook calls `onConversationChange(fresh)`
- **THEN** optimistic turn state is cleared and the parent receives the updated conversation, same as before the fix

