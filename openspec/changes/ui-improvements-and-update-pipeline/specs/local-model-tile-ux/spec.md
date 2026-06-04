## ADDED Requirements

### Requirement: verifying-info-alert
The local model adapter tile SHALL display an `InlineAlert kind="info"` below the
tile row when `adapter.diagnostic?.code === "verifying"`, with title
"Verifying download" and subtitle explaining the step may take a few minutes.

#### Scenario: alert shown during verification
- **WHEN** the adapter diagnostic code is `"verifying"`
- **THEN** an info-styled inline alert appears below the tile row with the text about verification taking a few minutes

#### Scenario: alert absent when not verifying
- **WHEN** the adapter diagnostic code is anything other than `"verifying"`
- **THEN** no verification alert is shown

---

### Requirement: failed-badge-suppression
The local model adapter tile SHALL NOT display the status badge when the adapter
is in a failed/error state and the Retry button is already visible. The error
detail SHALL instead appear in a `ConnectionIssueNotice` below the row.

#### Scenario: badge suppressed alongside retry button
- **WHEN** `adapter.available === false`, `adapter.diagnostic.severity === "error"`, and the Retry button is shown
- **THEN** no badge appears in the tile header row

#### Scenario: badge shown in non-error states
- **WHEN** the adapter is downloading, verifying, or ready
- **THEN** the status badge is displayed normally

---

### Requirement: download-progress-persistence
The local model adapter tile SHALL restore the download progress bar when the
Agents screen is mounted while a download is already in progress on the daemon.

#### Scenario: progress bar appears on remount
- **WHEN** a download is in progress (daemon `state.status === "downloading"`) and the AgentsPanel mounts
- **THEN** `downloadProgress` is set from the daemon response and the progress bar is rendered immediately

#### Scenario: polling restarts on remount
- **WHEN** the download is in progress and AgentsPanel mounts
- **THEN** a polling loop starts, updating `downloadProgress` every 1.5 s until the download completes

#### Scenario: polling stops on unmount
- **WHEN** the user navigates away from the Agents screen
- **THEN** `downloadPollingActiveRef.current` is set to false, stopping the polling loop
