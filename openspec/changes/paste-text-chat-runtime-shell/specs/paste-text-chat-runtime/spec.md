# paste-text-chat-runtime Specification — Delta for `paste-text-chat-runtime-shell`

> Desktop renderer orchestration for Chat (`/text-copy`): shell phases, optimistic turns, run polling, and scroll behavior. Does not change daemon API contracts.

## ADDED Requirements

### Requirement: Chat shell phases

The Chat renderer SHALL distinguish two layout phases: `welcome` and `active`.

#### Scenario: Welcome phase on first load

- **WHEN** the user opens `/text-copy` and no user message has been submitted in the current local session
- **THEN** the renderer shows a centered greeting and composer in the middle of the available viewport
- **AND** no message thread occupies the main scroll region

#### Scenario: Active phase on send start

- **WHEN** the user submits a message from the welcome phase
- **THEN** the renderer enters `active` phase before the send HTTP request completes
- **AND** displays an optimistic user message bubble
- **AND** anchors the composer to the bottom of the viewport

#### Scenario: Return to welcome on new conversation

- **WHEN** the user confirms a new conversation and no pending rewrite remains (or after canceling pending)
- **THEN** the renderer returns to `welcome` phase
- **AND** cancels in-flight run polling for the previous conversation

### Requirement: Optimistic turn merge

The desktop client SHALL merge optimistic local turns with server `PasteTextConversation.messages` without duplicate rows.

#### Scenario: Successful send reconcile

- **WHEN** `POST /paste-text/conversations/:id/messages` returns
- **THEN** optimistic placeholders are replaced by server messages with stable ids
- **AND** the pending assistant message from the response is shown

#### Scenario: Failed send

- **WHEN** the send request fails
- **THEN** the renderer removes the optimistic assistant placeholder
- **AND** preserves the user's draft text in the composer
- **AND** shows an error alert without leaving the UI in a stuck `sending` state

### Requirement: Run sync coordination

While an assistant message is `pending` and linked to `agentRunId`, the desktop SHALL poll `GET /agents/runs/:id` on a single coordinated loop per pending message.

#### Scenario: Poll lifecycle

- **WHEN** a pending assistant message has `agentRunId`
- **THEN** the client polls until the run reaches a terminal status (`completed`, `failed`, `canceled`)
- **AND** refreshes the conversation from the daemon on terminal status
- **AND** stops polling when the conversation id changes or the component unmounts

#### Scenario: Streaming text display

- **WHEN** poll returns incremental `text` events with `streamDelta`
- **THEN** the renderer shows accumulated text in the pending assistant bubble
- **AND** applies scroll policy without scrolling on every delta when the user is not near the bottom

### Requirement: No third-party chat runtime dependency

The Chat desktop implementation SHALL NOT depend on assistant-ui packages, registry, cloud services, skills, or external chat APIs.

#### Scenario: Dependency boundary

- **WHEN** the desktop package is built
- **THEN** `package.json` does not add `@assistant-ui/*` dependencies for this feature
- **AND** Chat UI is implemented with existing Writer components and daemon client only
