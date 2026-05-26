# spreadsheet-attachment-disk-ref — Delta for `platform-store-eviction`

> PasteText spreadsheet parse results are stored on disk; the platform store holds only `parseResultPath`.

## ADDED Requirements

### Requirement: Disk write on attach

When a spreadsheet is attached, the daemon SHALL persist the parse result to disk and omit inline `parseResult` from the store.

#### Scenario: Attach writes parse file

- **WHEN** `attachPasteTextFile` completes for a spreadsheet attachment
- **THEN** parsed JSON is written to `~/.writer/conversations/<conversationId>/attachment-parse-result.json`
- **AND** `conversation.attachment.parseResultPath` points at that file
- **AND** `conversation.attachment.parseResult` is absent from persisted `platform-store.json`

#### Scenario: Attach write failure

- **WHEN** the disk write fails (for example ENOSPC or EACCES)
- **THEN** the error propagates as HTTP 500 with a descriptive message
- **AND** no partial attachment data is persisted on the conversation

### Requirement: On-demand read during send

When sending with a row index, the daemon SHALL read the parse result from disk for that request only.

#### Scenario: Send reads parseResultPath

- **WHEN** `sendPasteTextMessage` is called with `rowIndex` and the attachment has `parseResultPath`
- **THEN** the daemon reads the parse result from that path to build row context
- **AND** does not retain the full parse result in the platform store snapshot

### Requirement: Contract schema for disk reference

`PasteTextAttachment` SHALL allow disk-backed attachments during migration and after.

#### Scenario: Optional parseResult and parseResultPath

- **WHEN** `pasteTextAttachmentSchema` is validated
- **THEN** `parseResult` is optional
- **AND** `parseResultPath` is an optional string
- **AND** both may coexist only during the load migration window

### Requirement: Load migration from inline parseResult

Legacy stores with inline `parseResult` SHALL be migrated on load.

#### Scenario: Migrate inline parse to disk

- **WHEN** `store.load()` finds a conversation with `parseResult` and no `parseResultPath`
- **THEN** the parse result is written to disk, `parseResultPath` is set, and inline `parseResult` is removed
- **AND** `store.save()` runs once after all such migrations complete

#### Scenario: Migration idempotency

- **WHEN** `store.load()` runs and the parse file already exists with `parseResultPath` set
- **THEN** that conversation is not migrated again
