## ADDED Requirements

### Requirement: gradient-progress-bar
The update modal downloading state SHALL display a gradient progress bar using the
same two-div flex pattern as the local model tile (`#3b4df2 → #bafde6 → white` fill,
`#666` remainder, `h-[3.8px]`).

#### Scenario: downloading state renders gradient bar
- **WHEN** `AppUpdateState.status === "downloading"`
- **THEN** the modal body shows a flex row with a gradient-filled div and a grey remainder div whose flex values sum to 100

#### Scenario: bar width tracks percent
- **WHEN** `percent` advances from 0 to 100
- **THEN** the fill div `flex` value equals `percent` and the remainder div `flex` value equals `100 - percent`

---

### Requirement: bytes-label-in-downloading-state
The downloading state label SHALL display `{percent}% · {transferredBytes} / {totalBytes}`
when byte counts are available, and fall back to `{percent}%` when they are not.

#### Scenario: label shows bytes when available
- **WHEN** `transferredBytes` and `totalBytes` are present in the downloading state
- **THEN** the label reads `{n}% · {x MB} / {y MB}`

#### Scenario: label falls back to percent only
- **WHEN** `totalBytes` is absent or zero
- **THEN** the label reads `{n}%` only

---

### Requirement: download-in-background-button
The downloading state footer SHALL show a single button labelled "Download in background"
that closes the modal. The button SHALL NOT say "Later".

#### Scenario: dismiss button label
- **WHEN** the modal is in downloading state
- **THEN** the footer contains exactly one button labelled "Download in background"

---

### Requirement: optimistic-downloading-state
Clicking the Upgrade button SHALL immediately transition the modal to
`{ status: "downloading", percent: 0 }` without waiting for the first
`download-progress` event from electron-updater.

#### Scenario: no freeze after Upgrade click
- **WHEN** the user clicks Upgrade
- **THEN** the modal immediately shows the downloading state at 0% before any IPC event fires

---

### Requirement: size-disclosure-in-available-state
The available state body SHALL display the installer size as
`{totalBytes} download · Your data and models will not be affected.`
when `totalBytes` is present in the state.

#### Scenario: size shown when available
- **WHEN** `AppUpdateState.status === "available"` and `totalBytes` is set
- **THEN** the footer line reads `{n} MB download · Your data and models will not be affected.`

#### Scenario: size omitted when absent
- **WHEN** `totalBytes` is absent from the available state
- **THEN** the footer line reads `Your data and models will not be affected.` only

---

### Requirement: available-state-contract-extension
The `available` variant of `AppUpdateState` SHALL include an optional `totalBytes`
field (`z.number().int().positive().optional()`) sourced from
`UpdateInfo.files[0].size`.

#### Scenario: contract parses available state with totalBytes
- **WHEN** `parseAppUpdateState({ status: "available", version: "1.0.0", totalBytes: 580_000_000 })` is called
- **THEN** it returns `{ status: "available", version: "1.0.0", totalBytes: 580_000_000 }` without throwing

---

### Requirement: downloading-state-contract-extension
The `downloading` variant of `AppUpdateState` SHALL include optional
`transferredBytes` and `totalBytes` fields sourced from electron-updater's
`ProgressInfo.transferred` and `ProgressInfo.total`.

#### Scenario: contract parses downloading state with bytes
- **WHEN** `parseAppUpdateState({ status: "downloading", percent: 42, transferredBytes: 160_000_000, totalBytes: 380_000_000 })` is called
- **THEN** it returns the full object without throwing
